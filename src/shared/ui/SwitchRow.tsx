/**
 * [POS]: Labeled row with a toggle switch — shared by popup/options (e.g. the enable switch)
 */
type SwitchRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export const SwitchRow = ({ title, description, checked, onChange, disabled }: SwitchRowProps) => (
  <div className="tr-row">
    <span className="tr-row__text">
      <span className="tr-row__title">{title}</span>
      {description && <span className="tr-row__desc">{description}</span>}
    </span>
    <label className="tr-switch">
      <input checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} type="checkbox" />
      <span className="tr-switch__track" />
    </label>
  </div>
);
