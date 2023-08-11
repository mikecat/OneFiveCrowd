"use strict";

var soundManager = (function() {
	let audioContext = null;
	let playerNode = null, playerError = false;
	let gainNode = null, gainToSet = 1;
	const playerWaiter = [];

	let nextQueryGen = 0;
	let runningQueryGen = null;

	// 制約回避のため、ユーザーの入力があってからAudioContextの初期化を行う
	const eventsForInitialize = [
		"keydown", "mousedown", "pointerdown", "pointerup", "touchend"
	];
	const initializeAudioContext = function(event) {
		if (event.type === "keydown" && event.key === "Escape") return;
		if (event.type === "pointerdown" && event.pointerType !== "mouse") return;
		if (event.type === "pointerup" && event.pointerType === "mouse") return;
		if (!navigator.userActivation || navigator.userActivation.hasBeenActive) {
			if (audioContext === null) {
				audioContext = new AudioContext();
				audioContext.audioWorklet.addModule("SoundPlayer.js").then(function() {
					playerNode = new AudioWorkletNode(audioContext, "SoundPlayer");
					playerNode.port.onmessage = function(event) {
						const data = event.data;
						if (data.type === "playDone") {
							if (data.gen === runningQueryGen) runningQueryGen = null;
						}
					};
					gainNode = audioContext.createGain();
					gainNode.gain.value = gainToSet;
					playerNode.connect(gainNode);
					gainNode.connect(audioContext.destination);
					playerWaiter.forEach(function(func) { func(); });
				}).catch(function(error) {
					playerError = true;
					console.error(error);
					playerWaiter.forEach(function(func) { func(); });
				});
			}
			audioContext.resume().then(function() {
				eventsForInitialize.forEach(function(eventName) {
					document.removeEventListener(eventName, initializeAudioContext);
				});
			}, function(error) {
				console.error(error);
			});
		}
	};
	eventsForInitialize.forEach(function(eventName) {
		document.addEventListener(eventName, initializeAudioContext);
	});

	// 初期化前の場合は、初期化が完了するまで待機する
	const waitForPlayerInitialization = async function() {
		if (playerNode === null && !playerError) {
			await new Promise(function(resolve, reject) {
				playerWaiter.push(resolve);
			});
		}
	};

	const addWorkletModule = async function(moduleFileName) {
		await waitForPlayerInitialization();
		await audioContext.audioWorklet.addModule(moduleFileName);
	};

	const addWorkletNode = async function(workletName) {
		await waitForPlayerInitialization();
		if (!gainNode) return null;
		const node = new AudioWorkletNode(audioContext, workletName);
		node.connect(gainNode);
		return node;
	};

	const getPlayerNode = async function() {
		await waitForPlayerInitialization();
		return playerNode;
	};

	const beep = async function(freq, durationMs) {
		const player = await getPlayerNode();
		if (player === null) return;
		runningQueryGen = nextQueryGen++;
		player.port.postMessage({
			"type": "play",
			"gen": runningQueryGen,
			"orders": [
				{
					"type": "sound",
					"freq": freq,
					"durationMs": durationMs,
				},
			],
		});
	};

	const play = (function() {
		const toneMap = {
			"C": -9,
			"D": -7,
			"E": -5,
			"F": -4,
			"G": -2,
			"A": 0,
			"B": 2,
		};
		const directOriginFreq = 8000;
		const originOctave = 3, originFreq = 220;
		return async function(mml, oldMode = false) {
			const tokenized = [];
			for (let i = 0; i < mml.length; i++) {
				const c = mml.charAt(i).toUpperCase();
				if ("ABCDEFG+#-R.TLO><$N".indexOf(c) >= 0) {
					tokenized.push(c);
				} else if ("0123456789".indexOf(c) >= 0) {
					let end = i + 1;
					while (end < mml.length && "0123456789".indexOf(mml.charAt(end)) >= 0) end++;
					tokenized.push(mml.substring(i, end));
					i = end - 1;
				} else if (c === " " || c === "\t" || c === "\n") {
					// 空白 (無視)
				} else {
					// その他 (終了)
					break;
				}
			}
			let octave = oldMode ? 4 : 3;
			let defaultNote = 4;
			const orders = [];
			for (let i = 0; i < tokenized.length; i++) {
				const token = tokenized[i];
				if ((token in toneMap) || token === "R" || token === "N") {
					let directSound = null, delta = 0, note = defaultNote;
					if(token === "N" && i + 1 < tokenized.length) {
						const ds = parseInt(tokenized[i + 1]);
						if (!isNaN(ds)) {
							directSound = ds;
							i++;
						}
					}
					if (i + 1 < tokenized.length) {
						if (tokenized[i + 1] === "+" || tokenized[i + 1] === "#") {
							delta = 1;
							i++;
						} else if (tokenized[i + 1] === "-") {
							delta = -1;
							i++;
						}
					}
					if (i + 1 < tokenized.length) {
						const len = parseInt(tokenized[i + 1]);
						if (!isNaN(len)) {
							if (len !== 0) note = len;
							i++;
						}
					}
					if (i + 1 < tokenized.length && tokenized[i + 1] === ".") {
						note = -note;
						i++;
					}
					if (token === "R" || (token === "N" && (directSound === null || directSound === 0))) {
						orders.push({
							"type": "break",
							"durationNote": note,
						});
					} else if (token === "N") {
						orders.push({
							"type": "sound",
							"freq": directOriginFreq / directSound,
							"durationNote": note,
						});
					} else {
						orders.push({
							"type": "sound",
							"freq": originFreq * Math.pow(2, octave - originOctave + (toneMap[token] + delta) / 12),
							"durationNote": note,
						});
					}
				} else if (token === "T") {
					if (i + 1 < tokenized.length) {
						const newTempo = parseInt(tokenized[i + 1]);
						if (isNaN(newTempo)) {
							break;
						} else {
							if (newTempo > 0) {
								orders.push({
									"type": "tempo",
									"tempo": newTempo,
								});
							}
							i++;
						}
					}
				} else if (token === "L") {
					if (i + 1 < tokenized.length) {
						const newDefaultNote = parseInt(tokenized[i + 1]);
						if (isNaN(newDefaultNote)) {
							break;
						} else {
							if (newDefaultNote > 0) defaultNote = newDefaultNote;
							i++;
						}
					}
				} else if (token === "O") {
					if (i + 1 < tokenized.length) {
						const newOctave = parseInt(tokenized[i + 1]);
						if (isNaN(newOctave)) {
							break;
						} else {
							octave = newOctave;
							if (octave > 9) octave = 9;
							i++;
						}
					}
				} else if (token === "<") {
					if (oldMode) {
						if (octave > 0) octave--;
					} else {
						if (octave < 9) octave++;
					}
				} else if (token === ">") {
					if (oldMode) {
						if (octave < 9) octave++;
					} else {
						if (octave > 0) octave--;
					}
				} else if (token === "$") {
					orders.push({
						"type": "repeat",
					});
				}
			}
			const player = await getPlayerNode();
			if (player === null) return;
			runningQueryGen = nextQueryGen++;
			player.port.postMessage({
				"type": "play",
				"gen": runningQueryGen,
				"orders": orders,
			});
		};
	})();

	const stop = async function(freq, durationMs) {
		const player = await getPlayerNode();
		if (player === null) return;
		player.port.postMessage({
			"type": "stop",
		});
	};

	const setTempo = async function(newTempo) {
		const player = await getPlayerNode();
		if (player === null) return;
		player.port.postMessage({
			"type": "tempo",
			"tempo": newTempo <= 0 ? 32767 : newTempo,
		});
	};

	const isPlaying = function() {
		return runningQueryGen !== null;
	};

	// volume: 0以上1以下の値
	const setVolume = function(volume) {
		const X = 32;
		const gain = (Math.pow(X, volume < 0 ? 0 : (volume > 1 ? 1 : volume)) - 1) / (X - 1);
		if (gainNode !== null) {
			gainNode.gain.linearRampToValueAtTime(gain, audioContext.currentTime + 0.05);
		} else {
			gainToSet = gain;
		}
	};

	return {
		"addWorkletModule": addWorkletModule,
		"addWorkletNode": addWorkletNode,
		"beep": beep,
		"play": play,
		"stop": stop,
		"setTempo": setTempo,
		"isPlaying": isPlaying,
		"setVolume": setVolume,
	};
})();
