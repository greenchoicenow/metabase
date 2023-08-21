(ns metabase.events.activity-feed
  (:require
   [metabase.events :as events]
   [metabase.mbql.util :as mbql.u]
   [metabase.models.activity :as activity :refer [Activity]]
   [metabase.models.card :refer [Card]]
   [metabase.models.dashboard :refer [Dashboard]]
   [metabase.models.table :as table]
   [metabase.query-processor :as qp]
   [metabase.util :as u]
   [metabase.util.i18n :refer [trs tru]]
   [metabase.util.log :as log]
   [methodical.core :as methodical]
   [toucan2.core :as t2]))

(derive ::event :metabase/event)

(def ^:private activity-feed-topics
  "The set of event topics which are subscribed to for use in the Metabase activity feed."
  #{:event/alert-create
    :event/alert-delete
    :event/card-create
    :event/card-update
    :event/card-delete
    :event/dashboard-create
    :event/dashboard-delete
    :event/dashboard-add-cards
    :event/dashboard-remove-cards
    :event/install
    :event/metric-create
    :event/metric-update
    :event/metric-delete
    :event/pulse-create
    :event/pulse-delete
    :event/segment-create
    :event/segment-update
    :event/segment-delete
    :event/user-joined
    :event/user-login})

(doseq [topic activity-feed-topics]
  (derive topic ::event))

(defmulti ^:private process-activity!
  {:arglists '([model-name topic object])}
  (fn [model-name _topic _object]
    (keyword model-name)))

(defmethod process-activity! :default
  [model-name _ _]
  (log/warn (trs "Don''t know how to process event with model {0}" model-name)))

(defmethod process-activity! :card
  [_ topic {query :dataset_query, dataset? :dataset :as object}]
  (let [details-fn  #(cond-> (select-keys % [:name :description])
                       ;; right now datasets are all models. In the future this will change so lets keep a breadcumb
                       ;; around
                       dataset? (assoc :original-model "card"))
        query       (when (seq query)
                      (try (qp/preprocess query)
                           (catch Throwable e
                             (log/error e (tru "Error preprocessing query:")))))
        database-id (some-> query :database u/the-id)
        table-id    (mbql.u/query->source-table-id query)]
    (activity/record-activity!
      :topic       topic
      :object      object
      :model       (when dataset? "dataset")
      :details-fn  details-fn
      :database-id database-id
      :table-id    table-id)))

(defmethod process-activity! :dashboard
  [_ topic object]
  (let [create-delete-details
        #(select-keys % [:description :name])

        add-remove-card-details
        (fn [{:keys [dashcards] :as obj}]
          ;; we expect that the object has just a dashboard :id at the top level
          ;; plus a `:dashcards` attribute which is a vector of the cards added/removed
          (-> (t2/select-one [Dashboard :description :name], :id (events/object->model-id topic obj))
              (assoc :dashcards (for [{:keys [id card_id]} dashcards]
                                  (-> (t2/select-one [Card :name :description], :id card_id)
                                      (assoc :id id)
                                      (assoc :card_id card_id))))))]
    (activity/record-activity!
      :topic      topic
      :object     object
      :details-fn (case topic
                    :event/dashboard-create       create-delete-details
                    :event/dashboard-delete       create-delete-details
                    :event/dashboard-add-cards    add-remove-card-details
                    :event/dashboard-remove-cards add-remove-card-details))))

(defmethod process-activity! :metric
  [_ topic object]
  (let [details-fn  #(select-keys % [:name :description :revision_message])
        table-id    (:table_id object)
        database-id (table/table-id->database-id table-id)]
    (activity/record-activity!
      :topic       topic
      :object      object
      :details-fn  details-fn
      :database-id database-id
      :table-id    table-id)))

(defmethod process-activity! :pulse
  [_ topic object]
  (let [details-fn #(select-keys % [:name])]
    (activity/record-activity!
      :topic      topic
      :object     object
      :details-fn details-fn)))

(defmethod process-activity! :alert
  [_ topic {:keys [card] :as alert}]
  (let [details-fn #(select-keys (:card %) [:name])]
    (activity/record-activity!
      ;; Alerts are centered around a card/question. Users always interact with the alert via the question
      :model      "card"
      :model-id   (:id card)
      :topic      topic
      :object     alert
      :details-fn details-fn)))

(defmethod process-activity! :segment
  [_ topic object]
  (let [details-fn  #(select-keys % [:name :description :revision_message])
        table-id    (:table_id object)
        database-id (table/table-id->database-id table-id)]
    (activity/record-activity!
      :topic       topic
      :object      object
      :details-fn  details-fn
      :database-id database-id
      :table-id    table-id)))

(defmethod process-activity! :user
  [_ topic object]
  (when (= :event/user-joined topic)
    (activity/record-activity!
      :topic    topic
      :user-id  (:user-id object)
      :model-id (:user-id object))))

(defmethod process-activity! :install
  [& _]
  (when-not (t2/exists? Activity :topic "install")
    (t2/insert! Activity, :topic "install", :model "install")))

(methodical/defmethod events/publish-event! ::event
  [topic object]
  ;; try/catch here to prevent individual topic processing exceptions from bubbling up.  better to handle them here.
  (try
    (when object
      (process-activity! (keyword (events/topic->model topic)) topic object))
    (catch Throwable e
      (log/warnf e "Failed to process activity event %s" topic)
      e)))
