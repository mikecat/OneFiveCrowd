"use strict";

class SoundPlayer extends AudioWorkletProcessor {
	constructor(...args) {
		super(...args);
		this.orderGen = null;
		this.orders = [];
		this.nextOrderIndex = 0;
		this.durationFrameLeft = -1
		this.durationInfinity = false;
		this.isHigh = false;
		this.toggleFrameInterval = -1;
		this.toggleFrameNext = -1;
		this.tempo = 120;
		this.repeatFrom = -1;
		const thisObj = this;
		this.port.onmessage = function(event) {
			const data = event.data;
			if (data.type === "play") {
				thisObj.orderGen = data.gen;
				thisObj.orders = data.orders;
				thisObj.nextOrderIndex = 0;
				thisObj.tempo = 120;
				thisObj.repeatFrom = -1;
				thisObj.processNextOrder(currentFrame);
			} else if (data.type === "stop") {
				thisObj.durationFrameLeft = -1;
				thisObj.orders = [];
				thisObj.nextOrderIndex = 0;
				if (thisObj.orderGen !== null) {
					thisObj.port.postMessage({
						"type": "playDone",
						"gen": this.orderGen,
					});
					thisObj.orderGen = null;
				}
			}
		};
	}

	processNextOrder(currentTimeFrame) {
		let repeated = false;
		for (;;) {
			if (this.nextOrderIndex >= this.orders.length) {
				if (this.repeatFrom >= 0 && this.repeatFrom < this.orders.length && !repeated) {
					repeated = true;
					this.nextOrderIndex = this.repeatFrom;
				} else {
					this.durationFrameLeft = -1;
					this.port.postMessage({
						"type": "playDone",
						"gen": this.orderGen,
					});
					this.orderGen = null;
					break;
				}
			}
			const order = this.orders[this.nextOrderIndex++];
			if (order.type === "sound" || order.type === "break") {
				if (order.type === "sound") {
					this.toggleFrameInterval = Math.round(sampleRate / order.freq / 2);
				} else {
					this.toggleFrameInterval = -1;
				}
				if (this.toggleFrameNext < currentTimeFrame) {
					this.toggleFrameNext = currentTimeFrame;
				}
				this.durationInfinity = false;
				if ("durationMs" in order) {
					if (order.durationMs < 0) {
						this.durationFrameLeft = 1;
						this.durationInfinity = true;
					} else {
						this.durationFrameLeft = Math.round(sampleRate * order.durationMs / 1000);
					}
				} else {
					const note4Duration = sampleRate * 60 / this.tempo;
					if (order.durationNote > 0) {
						this.durationFrameLeft = Math.round(note4Duration * 4 / order.durationNote);
					} else {
						this.durationFrameLeft = Math.round(note4Duration * 6 / -order.durationNote);
					}
				}
				break;
			} else if (order.type === "tempo") {
				this.tempo = order.tempo;
			} else if (order.type === "repeat") {
				this.repeatFrom = this.nextOrderIndex;
			}
		}
	}

	process(inputs, outputs, parameters) {
		const output = outputs[0][0];
		for (let i = 0; i < output.length; i++) {
			if (this.durationFrameLeft > 0) {
				const currentTimeFrame = currentFrame + i;
				if (this.toggleFrameInterval > 0) {
					if (currentTimeFrame === this.toggleFrameNext) {
						this.isHigh = !this.isHigh;
						this.toggleFrameNext = currentTimeFrame + this.toggleFrameInterval;
					}
					output[i] = this.isHigh ? 1 : -1;
				}
				if (!this.durationInfinity && --this.durationFrameLeft <= 0) {
					this.processNextOrder(currentTimeFrame + 1);
				}
			}
		}
		for (let i = 1; i < outputs[0].length; i++) {
			for (let j = 0; j < outputs[0][0].length; j++) {
				outputs[0][i][j] = outputs[0][0][j];
			}
		}
		return true;
	}
}

registerProcessor("SoundPlayer", SoundPlayer);
