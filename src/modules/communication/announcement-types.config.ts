export interface AnnouncementTypeConfig {
  value: string;
  label: string;
  description: string;
  color: string;
}

export const ANNOUNCEMENT_TYPES: AnnouncementTypeConfig[] = [
  { value: 'EVENT',   label: 'Event',   description: 'VC pitch, Networking', color: 'purple' },
  { value: 'SESSION', label: 'Session', description: 'Masterclass, Seminar', color: 'blue'   },
  { value: 'PROGRAM', label: 'Program', description: 'Bootcamp, Incubator',  color: 'green'  },
  { value: 'GENERAL', label: 'General', description: 'Notice, Subsidies',    color: 'gray'   },
];

export const ANNOUNCEMENT_TYPE_VALUES = ANNOUNCEMENT_TYPES.map(t => t.value);
