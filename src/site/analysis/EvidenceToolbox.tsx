import { useState } from 'react';

import { guides, insights, snapshots, teamNotes, type Snapshot } from 'site/demo/battle';
import { IconSlot } from 'site/ui/IconSlot';
import { Panel } from 'site/ui/Panel';
import sparkleUrl from 'site/ui/sparkle.svg';

const TONE_COLOR: Record<Snapshot['tone'], string> = {
  good: 'var(--status-good)',
  info: 'var(--status-info)',
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
};

const SECTIONS = [
  { key: 'jump', title: '快速跳转' },
  { key: 'snapshots', title: '关键技能快照' },
  { key: 'notes', title: '沟通与执行提示' },
  { key: 'guides', title: '攻略速查' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

interface EvidenceToolboxProps {
  focusId: string | null;
  onFocus: (id: string) => void;
}

/** 证据工具箱：手风琴，最多同时展开 2 组 */
export function EvidenceToolbox({ focusId, onFocus }: EvidenceToolboxProps) {
  const [open, setOpen] = useState<SectionKey[]>(['jump', 'snapshots']);

  const toggle = (key: SectionKey) => {
    setOpen((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      // 最多 2 组展开：挤掉最早的
      return [...prev, key].slice(-2);
    });
  };

  return (
    <>
      {SECTIONS.map((section) => {
        const isOpen = open.includes(section.key);
        return (
          <Panel key={section.key} className="toolbox-section">
            <button
              type="button"
              className="toolbox-section-head"
              onClick={() => toggle(section.key)}
              aria-expanded={isOpen}
            >
              <span className="t-eyebrow">{section.title}</span>
              <svg
                className={`toolbox-chev ${isOpen ? 'is-open' : ''}`}
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true"
              >
                <path d="M1 3l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" />
              </svg>
            </button>
            {isOpen && <div className="toolbox-section-body">{renderBody(section.key)}</div>}
          </Panel>
        );
      })}
    </>
  );

  function renderBody(key: SectionKey) {
    switch (key) {
      case 'jump':
        return insights.map((ins) => (
          <button
            key={ins.id}
            type="button"
            className={`jump-row ${focusId === ins.id ? 'is-focus' : ''}`}
            onClick={() => onFocus(ins.id)}
          >
            <span className="jump-row-no">{ins.no}</span>
            <span>{ins.title}</span>
            <span className="jump-row-time">{ins.at}</span>
          </button>
        ));
      case 'snapshots':
        return (
          <div className="snapshot">
            {snapshots.map((snap) => (
              <div key={snap.name} className="snapshot-row">
                <span className="snapshot-name">
                  <IconSlot icon={snap.icon} size={32} alt={snap.name} />
                  {snap.name}
                </span>
                <span className="snapshot-track">
                  <span
                    className="snapshot-bar-fill"
                    style={{ width: `${snap.ratio * 100}%`, background: TONE_COLOR[snap.tone] }}
                  />
                </span>
                <span className="snapshot-value">{snap.value}</span>
              </div>
            ))}
          </div>
        );
      case 'notes':
        return teamNotes.map((note) => (
          <div key={note} className="toolbox-note">
            <img src={sparkleUrl} alt="" className="toolbox-note-mark" />
            <span>{note}</span>
          </div>
        ));
      case 'guides':
        return guides.map((guide) => (
          <a key={guide.name} href="#" className="guide-link" onClick={(e) => e.preventDefault()}>
            <img src={sparkleUrl} alt="" className="toolbox-note-mark" />
            <span>{guide.name}</span>
            <span className="t-meta" style={{ marginLeft: 'auto' }}>
              {guide.meta}
            </span>
          </a>
        ));
    }
  }
}
