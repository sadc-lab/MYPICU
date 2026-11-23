import { useMemo, useState } from 'react';
import { Brain } from 'lucide-react';
import {
  CollapsibleModuleCard,
  StatusIconCircle,
  ModuleStatus,
} from '@/components/CollapsibleModuleCard';
import { computeNeurologicalState, PatientFileData } from '@/services/patientFileData.service';
import { getRifleStage, getRifleStages } from '@/utils/renalStatus';
import kidneyIcon from '@/assets/kidney-icon.svg';
import { cn } from '@/lib/utils';
import { tr } from '@/i18n';

interface OrganClassificationsProps {
  patientId: string;
  patientFileData: PatientFileData | null;
}

interface ClassRow {
  key: string;
  badge?: string;
  label: string;
  criteria: string;
  status: ModuleStatus;
  extra?: string;
}

const HOURS = 24;

const ROW_ACTIVE: Record<ModuleStatus, string> = {
  normal: 'border-primary/40 bg-primary/5',
  warning: 'border-status-warning/40 bg-status-warning-bg/30',
  critical: 'border-status-critical/40 bg-status-critical-bg/30',
  inactive: 'border-transparent bg-muted/40',
};

const TEXT_ACTIVE: Record<ModuleStatus, string> = {
  normal: 'text-foreground',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
  inactive: 'text-foreground',
};

const BADGE_ACTIVE: Record<ModuleStatus, string> = {
  normal: 'bg-primary text-primary-foreground',
  warning: 'bg-status-warning text-white',
  critical: 'bg-status-critical text-white',
  inactive: 'bg-muted text-muted-foreground',
};

const ClassificationList = ({ rows, activeKey }: { rows: ClassRow[]; activeKey: string | null }) => (
  <div className="space-y-2">
    {rows.map((row) => {
      const active = row.key === activeKey;
      return (
        <div
          key={row.key}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 border',
            active ? ROW_ACTIVE[row.status] : 'border-transparent bg-muted/40'
          )}
        >
          {row.badge && (
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold shrink-0',
                active ? BADGE_ACTIVE[row.status] : 'bg-muted text-muted-foreground'
              )}
            >
              {row.badge}
            </div>
          )}
          <span
            className={cn(
              'text-sm font-semibold shrink-0',
              !row.badge && 'w-32',
              active ? TEXT_ACTIVE[row.status] : 'text-foreground'
            )}
          >
            {row.label}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground flex-1">{row.criteria}</span>
          {row.extra && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{row.extra}</span>
          )}
        </div>
      );
    })}
  </div>
);

/** Classifications d'état par organe (cérébrale, rénale RIFLE), affichées dans Optistate. */
export const OrganClassifications = ({ patientId, patientFileData }: OrganClassificationsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [brainOpen, setBrainOpen] = useState(true);
  const [renalOpen, setRenalOpen] = useState(true);

  // Cérébrale : mêmes seuils que classifyNeuroState (PIC/PPC), sur 24 h.
  const neuro = useMemo(
    () => (patientFileData ? computeNeurologicalState(patientFileData, HOURS) : null),
    [patientFileData]
  );
  const neuroBaseRows: ClassRow[] = [
    { key: 'controlled', label: tr('Contrôlé', 'Controlled'), criteria: tr('PIC < 20 mmHg et PPC 50–80 mmHg', 'ICP < 20 mmHg and CPP 50–80 mmHg'), status: 'normal' },
    { key: 'htic', label: tr('HTIC', 'ICH'), criteria: tr('PIC ≥ 20 mmHg', 'ICP ≥ 20 mmHg'), status: 'warning' },
    { key: 'ischemia', label: tr('Ischémie', 'Ischaemia'), criteria: tr('PPC < 50 mmHg', 'CPP < 50 mmHg'), status: 'critical' },
    { key: 'htic_ischemia', label: tr('HTIC + Ischémie', 'ICH + Ischaemia'), criteria: tr('PIC ≥ 20 mmHg et PPC < 50 mmHg', 'ICP ≥ 20 mmHg and CPP < 50 mmHg'), status: 'critical' },
    { key: 'hyperemia', label: tr('Hyperémie', 'Hyperaemia'), criteria: tr('PPC > 80 mmHg avec PIC normale', 'CPP > 80 mmHg with normal ICP'), status: 'warning' },
  ];
  const neuroRows: ClassRow[] = neuroBaseRows.map((row) => {
    if (!neuro?.hasData) return row;
    const pct = {
      controlled: neuro.history.controlled,
      htic: neuro.history.htic,
      ischemia: neuro.history.ischemia,
      htic_ischemia: neuro.history.hticWithIschemia,
      hyperemia: neuro.history.hyperemia,
    }[row.key];
    return { ...row, extra: tr(`${pct}% du temps (${HOURS}h)`, `${pct}% of the time (${HOURS}h)`) };
  });
  const neuroActive = neuro?.hasData ? neuroRows.find((r) => r.key === neuro.currentState) ?? null : null;

  // Rénale : RIFLE.
  const rifle = getRifleStage(patientId);
  const rifleRows: ClassRow[] = getRifleStages().map((st) => ({
    key: st.letter,
    badge: st.letter,
    label: st.name,
    criteria: st.criteria,
    status: 'critical',
  }));
  const rifleActive = rifleRows.find((r) => r.key === rifle) ?? null;

  const overallStatus: ModuleStatus =
    neuroActive?.status === 'critical' || rifleActive
      ? 'critical'
      : neuroActive?.status === 'warning'
        ? 'warning'
        : neuroActive
          ? 'normal'
          : 'inactive';

  return (
    <CollapsibleModuleCard
      expanded={expanded}
      onToggle={() => setExpanded((p) => !p)}
      headerIcon={
        <StatusIconCircle status={overallStatus}>
          <span className="text-sm sm:text-base">{(neuroActive ? 1 : 0) + (rifleActive ? 1 : 0)}</span>
        </StatusIconCircle>
      }
      title={tr("Classifications d'organes", "Organ classifications")}
      subtitle={
        <>
          {tr('Cérébral :', 'Brain:')}{' '}
          <span className={cn('font-semibold', neuroActive ? TEXT_ACTIVE[neuroActive.status] : '')}>
            {neuroActive ? neuroActive.label : tr('pas de données', 'no data')}
          </span>
          {' • '}{tr('Rénal :', 'Kidney:')}{' '}
          <span className={cn('font-semibold', rifleActive ? 'text-status-critical' : '')}>
            {rifleActive ? `RIFLE ${rifleActive.key} (${rifleActive.label})` : tr('pas de données', 'no data')}
          </span>
        </>
      }
    >
      <div className="space-y-4 pt-4 border-t">
        <CollapsibleModuleCard
          variant="nested"
          expanded={brainOpen}
          onToggle={() => setBrainOpen((p) => !p)}
          headerIcon={
            <StatusIconCircle size="sm" status={neuroActive?.status ?? 'inactive'}>
              <Brain className="h-5 w-5 sm:h-6 sm:w-6" />
            </StatusIconCircle>
          }
          title={tr("Classification cérébrale", "Brain classification")}
          subtitle={
            neuroActive ? (
              <>
                {tr('État actuel :', 'Current state:')}{' '}
                <span className={cn('font-semibold', TEXT_ACTIVE[neuroActive.status])}>{neuroActive.label}</span>
                {neuro?.currentStateSince && ` ${neuro.currentStateSince}`}
              </>
            ) : (
              tr('Pas de données PIC/PPC', 'No ICP/CPP data')
            )
          }
        >
          <div className="pt-4 border-t">
            <ClassificationList rows={neuroRows} activeKey={neuroActive?.key ?? null} />
          </div>
        </CollapsibleModuleCard>

        <CollapsibleModuleCard
          variant="nested"
          expanded={renalOpen}
          onToggle={() => setRenalOpen((p) => !p)}
          headerIcon={
            <StatusIconCircle size="sm" status={rifleActive ? 'critical' : 'inactive'}>
              <img
                src={kidneyIcon}
                alt="kidney"
                className="h-5 w-5 sm:h-6 sm:w-6"
                style={{
                  filter: rifleActive
                    ? 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'
                    : 'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)',
                }}
              />
            </StatusIconCircle>
          }
          title={tr("Classification rénale (RIFLE)", "Kidney classification (RIFLE)")}
          subtitle={
            rifleActive ? (
              <>
                {tr('Stade actuel :', 'Current stage:')}{' '}
                <span className="font-semibold text-status-critical">
                  {rifleActive.key} — {rifleActive.label}
                </span>
              </>
            ) : (
              tr('Pas de données rénales', 'No kidney data')
            )
          }
        >
          <div className="pt-4 border-t">
            <ClassificationList rows={rifleRows} activeKey={rifleActive?.key ?? null} />
          </div>
        </CollapsibleModuleCard>
      </div>
    </CollapsibleModuleCard>
  );
};
