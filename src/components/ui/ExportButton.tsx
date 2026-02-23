import Icon from "./Icon";

import { memo } from "react";

export default memo(function ExportButton({ label, desc, onClick }) {
  return (
    <button className="export-btn" onClick={onClick}>
      <div className="export-btn-title">
        <Icon name="download" size={16} />
        {label}
      </div>
      <span className="export-btn-desc">{desc}</span>
    </button>
  );
})
