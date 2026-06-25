export interface MessageDescriptor {
  id: string;
  message: string;
}

export const i18n = {
  locale: 'en',
  _: <T>(_descriptor: T): string => '',
};
