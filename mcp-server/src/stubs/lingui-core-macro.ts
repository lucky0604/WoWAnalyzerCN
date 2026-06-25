interface MessageDescriptor {
  id: string;
  message: string;
  comment?: string;
}

export function defineMessage(
  descriptor: Omit<MessageDescriptor, 'id'> & { id?: string },
): MessageDescriptor {
  return { id: descriptor.id ?? '', message: descriptor.message };
}
