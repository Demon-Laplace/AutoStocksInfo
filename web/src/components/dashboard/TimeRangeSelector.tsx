import type { TimeRange } from "../../lib/types";

const ranges: TimeRange[] = ["1W", "1M", "6M", "1Y", "MAX"];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="range-selector" aria-label="时间范围">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          className={value === range ? "active" : ""}
          onClick={() => onChange(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export default TimeRangeSelector;
