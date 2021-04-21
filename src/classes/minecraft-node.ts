import { v4 as randomUUID } from 'uuid';

import { Account, MinecraftWebSocket, Scope, Sendable, Frame, Packet } from '@/types';
import { logger } from '@/helpers';

export const timeout = +process.env.STATSERVICE_TIMEOUT || 5000;

export const runningRequests: Record<string, (frame: Frame) => void> = {};

export let nodeCounter = 0;

export class MinecraftNode {
    isAlive = true;
    name: string;
    account: Account;
    scopes: Scope[] = [];
    nodeIndex = ++nodeCounter;
    nodeName = 'unknown';

    constructor(readonly socket: MinecraftWebSocket, readonly address: string) {
        socket.minecraftNode = this;
    }

    toString(): string {
        return `node-${this.nodeIndex}/${this.account?.id || this.address}/${this.nodeName.trim()}`;
    }

    log(message: string, level = 'info'): void {
        logger.log(level, this.toString() + ' > ' + message);
    }

    sendRequest(sendable: Sendable<Packet>): Promise<Frame> {
        const frame: Frame = {
            type: sendable[0],
            data: sendable[1],
            uuid: randomUUID(),
        };

        return new Promise<Frame>(resolve => {
            const wait = setTimeout(() => {
                delete runningRequests[frame.uuid];
                resolve({
                    type: 'error',
                    data: { errorLevel: 'TIMEOUT', errorMessage: 'Timeout' },
                });
            }, timeout);

            runningRequests[frame.uuid] = frame => {
                clearTimeout(wait);
                delete runningRequests[frame.uuid];
                resolve(frame);
            };

            this.sendFrame(frame);
        });
    }

    sendPacket(sendable: Sendable<Packet>): void {
        const frame: Frame = {
            type: sendable[0],
            data: sendable[1],
        };

        this.sendFrame(frame);
    }

    sendFrame(frame: Frame): void {
        this.socket.send(JSON.stringify(frame));
    }

    getScope(scopeId: string): Scope {
        for (const scope of this.scopes) {
            if (scope.id == scopeId) return scope;
        }
    }
}
