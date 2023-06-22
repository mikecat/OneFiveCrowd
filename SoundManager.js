"use strict";

var soundManager = (function() {
	let audioContext = null;
	let playerNode = null, playerError = false;
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
					playerNode.connect(audioContext.destination);
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
	const getPlayerNode = async function() {
		if (playerNode === null && !playerError) {
			await new Promise(function(resolve, reject) {
				playerWaiter.push(resolve);
			});
		}
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

	const stop = async function(freq, durationMs) {
		const player = await getPlayerNode();
		if (player === null) return;
		player.port.postMessage({
			"type": "stop",
		});
	};

	const isPlaying = function() {
		return runningQueryGen !== null;
	};

	return {
		"beep": beep,
		"stop": stop,
		"isPlaying": isPlaying,
	};
})();
