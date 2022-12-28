"use strict";

async function commandWAIT(args) {
	// 指定した時間待機する
	let timeToWait = Math.abs(args[0]) * 1000 / (TICK_PER_SECOND * (args[0] < 0 ? TICK_HIRES_MULT : 1));
	let startTime = performance.now();
	if (timeToWait >= 15) updateScreen();
	for (;;) {
		pollBreak();
		if (timeToWait < 10){
			while (performance.now() - startTime < timeToWait);
			return null;
		} else if (timeToWait <= 200) {
			return new Promise(function(resolve, reject) {
				setTimeout(function() { resolve(null); }, timeToWait);
			});
		} else {
			await new Promise(function(resolve, reject) {
				setTimeout(function() { resolve(null); }, 200);
			});
			const currentTime = performance.now();
			timeToWait -= currentTime - startTime;
			startTime = currentTime;
		}
	}
}

function commandRUN() {
	// プログラムを最初の行から実行する
	if (prgDirty) compileProgram();
	let lineToExecute = -1;
	const keys = Object.keys(programs);
	for (let i = 0; i < keys.length; i++) {
		const lineNo = parseInt(keys[i]);
		if (!isNaN(lineNo) && lineNo > 0 && (lineToExecute <= 0 || lineNo < lineToExecute)) {
			lineToExecute = lineNo;
		}
	}
	return [lineToExecute, 0];
}

async function commandLIST(args) {
	// メモリ上のプログラムを出力する
	let showMin, showMax;
	if (args.length === 0) {
		showMin = LINE_NUMBER_MIN;
		showMax = LIST_DEFAULT_SHOW_MAX;
	} else if (args.length === 1) {
		if (args[0] < 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = -args[0];
		} else if (args[0] === 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = LIST_DEFAULT_SHOW_MAX;
		} else {
			showMin = args[0];
			showMax = args[0];
		}
	} else {
		if (args[0] > 0 && args[1] > 0) {
			showMin = args[0];
			showMax = args[1];
		} else if (args[0] < 0 && args[1] < 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = LINE_NUMBER_MAX;
		} else if (args[0] < 0 && args[1] > 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = args[1];
		} else if (args[0] > 0 && args[1] < 0) {
			showMin = args[0];
			showMax = LINE_NUMBER_MAX;
		} else if (args[0] === 0) {
			if (args[1] > 0) {
				showMin = LINE_NUMBER_MIN;
				showMax = args[1];
			} else if (args[1] < 0) {
				showMin = LINE_NUMBER_MIN;
				showMax = LINE_NUMBER_MAX;
			} else { // args[1] === 0
				showMin = LINE_NUMBER_MIN;
				showMax = LIST_DEFAULT_SHOW_MAX;
			}
		} else { // args[1] === 0
			if (args[0] > 0) {
				showMin = args[0];
				showMax = args[0] <= LIST_DEFAULT_SHOW_MAX ? LIST_DEFAULT_SHOW_MAX : LINE_NUMBER_MAX;
			} else { // args[0] < 0
				showMin = LINE_NUMBER_MIN;
				showMax = LINE_NUMBER_MAX;
			}
		}
	}
	let ptr = 0;
	let shownCount = 0;
	while (ptr + 3 <= prgView.length) {
		const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
		const lineLength = prgView[ptr + 2];
		if (showMin <= lineNo && lineNo <= showMax && ptr + 3 + lineLength <= prgView.length) {
			let line = "" + lineNo + " ";
			for (let i = 0; i < lineLength && ptr + 3 + i < prgView.length && prgView[ptr + 3 + i] !== 0; i++) {
				line += String.fromCharCode(prgView[ptr + 3 + i]);
			}
			const shownCountDelta = 1 + Math.floor(line.length / SCREEN_WIDTH);
			if (shownCount + shownCountDelta > LIST_WAIT_LINES) {
				await commandWAIT([LIST_WAIT_TIME]);
				shownCount = 0;
			}
			shownCount += shownCountDelta;
			putString(line + "\n");
		}
		ptr += lineLength + 4;
	}
}

function commandGOTO(args) {
	// プログラムを指定の行から実行する
	if (prgDirty) compileProgram();
	if (args[0] > 0 && (args[0] in programs)) {
		return [args[0], 0];
	} else {
		throw "Line error";
	}
}

function commandEND(){
	// プログラムの実行を終了する
	return [-1, 0];
}

function commandPOKE(args) {
	// 仮想メモリにデータを書き込む
	for (let i = 1; i < args.length; i++) {
		writeVirtualMem(args[0] + i - 1, args[i]);
	}
}

function commandLOCATE(args) {
	// カーソルを移動する
	let x = args[0], y = args.length > 1 ? args[1] : 0;
	if (x < 0) x = 0;
	if (x >= SCREEN_WIDTH) x = SCREEN_WIDTH - 1;
	if (y < -1) y = -1;
	if (y >= SCREEN_HEIGHT) y = SCREEN_HEIGHT - 1;
	cursorX = x;
	cursorY = y;
}
