import styles from 'interface/report/Results/Timeline/configuration/GeneralConfiguration.module.scss';

export interface GeneralConfigurationProps {
  isMovementVisible: boolean;
  toggleMovementVisibility: (isVisible: boolean) => void;
}
export const GeneralConfiguration = ({
  isMovementVisible,
  toggleMovementVisibility,
}: GeneralConfigurationProps) => {
  return (
    <>
      <div className={styles['general-config-header']}>
        <h4>通用</h4>
      </div>

      <div className={styles['general-config-list']}>
        <label className={styles['general-config-item']}>
          <input
            type="checkbox"
            checked={isMovementVisible}
            onChange={(e) => toggleMovementVisibility(e.target.checked)}
          />
          在时间轴上显示移动覆盖层
        </label>
      </div>
    </>
  );
};
