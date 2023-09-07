/* eslint-disable react/prop-types */
import { useRef } from "react";
import { t, jt } from "ttag";
import _ from "underscore";

import { formatValue } from "metabase/lib/formatting";
import { color } from "metabase/lib/colors";

import Tooltip from "metabase/core/components/Tooltip";

import { columnSettings } from "metabase/visualizations/lib/settings/column";
import { NoBreakoutError } from "metabase/visualizations/lib/errors";
import { compactifyValue } from "metabase/visualizations/lib/scalar_utils";

import ScalarValue, {
  ScalarWrapper,
  ScalarTitle,
} from "metabase/visualizations/components/ScalarValue";
import * as Lib from "metabase-lib";
import {
  getDefaultSize,
  getMinSize,
} from "metabase/visualizations/shared/utils/sizes";

import { isDate } from "metabase-lib/types/utils/isa";

import { ScalarContainer } from "../Scalar/Scalar.styled";

import { ICON_SIZE, TOOLTIP_ICON_SIZE } from "./constants";
import {
  PreviousValue,
  PreviousValueContainer,
  PreviousValueSeparator,
  PreviousValueWrapper,
  Separator,
  Variation,
  VariationIcon,
  VariationTooltip,
  VariationValue,
} from "./SmartScalar.styled";
import {
  formatChange,
  formatChangeAutoPrecision,
  getCanShowPreviousValue,
  getChangeWidth,
  getTitleLinesCount,
  getValueHeight,
  getValueWidth,
} from "./utils";

export function SmartScalar(props) {
  const {
    actionButtons,
    onChangeCardAndRun,
    onVisualizationClick,
    isDashboard,
    settings,
    visualizationIsClickable,
    series: [
      {
        card,
        data: { rows, cols },
      },
    ],
    rawSeries,
    gridSize,
    width,
    height,
    totalNumGridCols,
    fontFamily,
  } = props;

  const _scalar = useRef(null);

  const metricIndex = cols.findIndex(col => !isDate(col));
  const dimensionIndex = cols.findIndex(col => isDate(col));

  const lastRow = rows[rows.length - 1];
  const value = lastRow?.[metricIndex];
  const column = cols[metricIndex];

  const insights = rawSeries?.[0].data?.insights;
  const insight = _.findWhere(insights, { col: column.name });
  if (!insight) {
    return null;
  }

  const lastValue = insight["last-value"];
  const formatOptions = settings.column(column);

  const { displayValue, fullScalarValue } = compactifyValue(
    lastValue,
    width,
    formatOptions,
  );

  const granularity = Lib.describeTemporalUnit(insight["unit"]).toLowerCase();

  const lastChange = insight["last-change"];
  const previousValue = insight["previous-value"];

  const isNegative = lastChange < 0;
  const isSwapped = settings["scalar.switch_positive_negative"];

  // if the number is negative but thats been identified as a good thing (e.g. decreased latency somehow?)
  const changeColor = (isSwapped ? !isNegative : isNegative)
    ? color("error")
    : color("success");

  const titleLinesCount = getTitleLinesCount(height);

  const changeDisplay = formatChangeAutoPrecision(lastChange, {
    fontFamily,
    fontWeight: 900,
    width: getChangeWidth(width),
  });

  const tooltipSeparator = <Separator>•</Separator>;
  const previousValueSeparator = (
    <PreviousValueSeparator>•</PreviousValueSeparator>
  );
  const granularityDisplay = jt`last ${granularity}`;
  const previousValueDisplay = formatValue(
    previousValue,
    settings.column(column),
  );

  const previousValueDisplayInTooltip = jt`${tooltipSeparator} was ${previousValueDisplay} ${granularityDisplay}`;
  const previousValueDisplayInCard = jt`${previousValueSeparator} was ${previousValueDisplay} ${granularityDisplay}`;
  const canShowPreviousValue = getCanShowPreviousValue({
    width,
    change: changeDisplay,
    previousValue:
      typeof previousValueDisplayInTooltip === "string"
        ? previousValueDisplayInTooltip
        : previousValueDisplayInTooltip.join(""),
    fontFamily,
  });
  const iconName = isNegative ? "arrow_down" : "arrow_up";

  const clicked = {
    value,
    column,
    dimensions: [
      {
        value: rows[rows.length - 1][dimensionIndex],
        column: cols[dimensionIndex],
      },
    ],
    data: rows[rows.length - 1].map((value, index) => ({
      value,
      col: cols[index],
    })),
    settings,
  };

  const isClickable = visualizationIsClickable(clicked);

  return (
    <ScalarWrapper>
      <div className="Card-title absolute top right p1 px2">
        {actionButtons}
      </div>
      <ScalarContainer
        className="fullscreen-normal-text fullscreen-night-text"
        data-testid="scalar-container"
        tooltip={fullScalarValue}
        alwaysShowTooltip={fullScalarValue !== displayValue}
        isClickable={isClickable}
      >
        <span
          onClick={
            isClickable &&
            (() =>
              _scalar.current &&
              onVisualizationClick({ ...clicked, element: _scalar.current }))
          }
          ref={_scalar}
        >
          <ScalarValue
            fontFamily={fontFamily}
            gridSize={gridSize}
            height={getValueHeight(height, canShowPreviousValue)}
            totalNumGridCols={totalNumGridCols}
            value={displayValue}
            width={getValueWidth(width)}
          />
        </span>
      </ScalarContainer>
      {isDashboard && (
        <ScalarTitle
          lines={titleLinesCount}
          title={settings["card.title"]}
          description={settings["card.description"]}
          onClick={
            onChangeCardAndRun && (() => onChangeCardAndRun({ nextCard: card }))
          }
        />
      )}

      <PreviousValueWrapper data-testid="scalar-previous-value">
        {lastChange == null || previousValue == null ? (
          <div
            className="text-centered text-bold mt1"
            style={{ color: color("text-medium") }}
          >{jt`Nothing to compare for the previous ${granularity}.`}</div>
        ) : lastChange === 0 ? (
          t`No change from last ${granularity}`
        ) : (
          <PreviousValueContainer>
            <Tooltip
              isEnabled={!canShowPreviousValue}
              placement="bottom"
              tooltip={
                <VariationTooltip>
                  <Variation>
                    <VariationIcon name={iconName} size={TOOLTIP_ICON_SIZE} />
                    <VariationValue showTooltip={false}>
                      {formatChange(lastChange)}
                    </VariationValue>
                  </Variation>

                  {previousValueDisplayInTooltip}
                </VariationTooltip>
              }
            >
              <Variation color={changeColor}>
                <VariationIcon name={iconName} size={ICON_SIZE} />
                <VariationValue showTooltip={false}>
                  {changeDisplay}
                </VariationValue>
              </Variation>
            </Tooltip>

            {canShowPreviousValue && (
              <PreviousValue id="SmartScalar-PreviousValue" responsive>
                {previousValueDisplayInCard}
              </PreviousValue>
            )}
          </PreviousValueContainer>
        )}
      </PreviousValueWrapper>
    </ScalarWrapper>
  );
}

SmartScalar.uiName = t`Trend`;
SmartScalar.identifier = "smartscalar";
SmartScalar.iconName = "smartscalar";
SmartScalar.canSavePng = false;

SmartScalar.minSize = getMinSize("smartscalar");
SmartScalar.defaultSize = getDefaultSize("smartscalar");

SmartScalar.noHeader = true;

SmartScalar.settings = {
  ...columnSettings({
    getColumns: (
      [
        {
          data: { cols },
        },
      ],
      settings,
    ) => [
      // try and find a selected field setting
      cols.find(col => col.name === settings["scalar.field"]) ||
        // fall back to the second column
        cols[1] ||
        // but if there's only one column use that
        cols[0],
    ],
  }),
  "scalar.switch_positive_negative": {
    title: t`Switch positive / negative colors?`,
    widget: "toggle",
    inline: true,
  },
  click_behavior: {},
};

SmartScalar.isSensible = ({ insights }) => {
  return insights && insights.length > 0;
};

// Smart scalars need to have a breakout
SmartScalar.checkRenderable = (
  [
    {
      data: { insights },
    },
  ],
  settings,
) => {
  if (!insights || insights.length === 0) {
    throw new NoBreakoutError(
      t`Group by a time field to see how this has changed over time`,
    );
  }
};
