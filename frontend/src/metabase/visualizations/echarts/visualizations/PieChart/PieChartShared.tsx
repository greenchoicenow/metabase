import type { IsomorphicVizProps } from "metabase/visualizations/types";

import { EChartsRenderer } from "../../EChartsRenderer";
import { useEChartsConfig } from "../../use-echarts-config";
import {
  pieSeriesMixin,
  totalMixin,
  showPercentagesOnChartMixin,
} from "./mixins";
// import { PieChartLegend } from "./PieChartLegend";
import { useChartDimension } from "./utils";

export function PieChartShared(props: IsomorphicVizProps) {
  const config = useEChartsConfig({
    chartType: "pie",
    props,
    mixins: [pieSeriesMixin, showPercentagesOnChartMixin, totalMixin],
  });
  const { sideLength, onChartDimensionChange } = useChartDimension();

  return (
    <EChartsRenderer config={config} width={sideLength} height={sideLength} />
  );

  // return (
  //   <PieChartLegend onChartDimensionChange={onChartDimensionChange} {...props}>
  //     <EChartsRenderer config={config} width={sideLength} height={sideLength} />
  //   </PieChartLegend>
  // );
}
