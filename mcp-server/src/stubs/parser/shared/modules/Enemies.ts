import { AnyEvent } from 'parser/core/Events';

export function encodeEventTargetString(_event: AnyEvent): string {
  return '';
}

export default class Enemies {
  isEnemy(_id: number, _instance?: number): boolean {
    return false;
  }
}
