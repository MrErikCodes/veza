import { read } from '../Util/Header';
import { deserializeWithMetadata } from 'binarytf';

/**
 * The queue class that manages messages.
 * @since 0.1.0
 */
export class Queue extends Map<number, QueueEntry> {

	/**
	 * The offset for this message.
	 * @since 0.1.0
	 */
	private offset: number = 0;

	/**
	 * The remaining buffer to truncate with other buffers.
	 * @since 0.1.0
	 */
	private _rest: Uint8Array | null = null;

	/**
	 * Returns a new Iterator object that parses each value for this queue.
	 * @since 0.1.0
	 */
	public *process(buffer: Uint8Array | null) {
		if (this._rest) {
			buffer = Buffer.concat([this._rest, buffer!]);
			this._rest = null;
		}

		while (buffer) {
			// If the header separator was not found, it may be due to an impartial message
			/* istanbul ignore next: This is hard to reproduce in Azure, it needs the buffer to overflow and split to extremely precise byte lengths. */
			if (buffer.length - this.offset <= 11) {
				this._rest = buffer;
				break;
			}

			const { id, receptive, byteLength } = read(buffer.subarray(this.offset, this.offset + 11));

			// If the message is longer than it can read, buffer the content for later
			if (byteLength > buffer.byteLength) {
				this._rest = buffer;
				break;
			}

			try {
				const { value, offset } = deserializeWithMetadata(buffer, this.offset + 11);
				if (offset === -1) {
					this.offset = 0;
					buffer = null;
				} else {
					this.offset = offset;
				}
				yield { id, receptive, data: value };
			} catch (error) {
				this.offset = 0;
				yield { id: null, receptive: false, data: error };
				break;
			}
		}
	}

}

/**
 * An entry for this queue
 */
interface QueueEntry {
	resolve: (value: any) => void;
	reject: (error: Error) => void;
}