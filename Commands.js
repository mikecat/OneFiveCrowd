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

function commandSCROLL(args) {
	// 画面をスクロールする
	switch (args[0]) {
		case 0: case 30: // 上
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				for (let y = 0; y < SCREEN_HEIGHT - 1; y++) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * (y + 1) + x];
				}
				vramView[SCREEN_WIDTH * (SCREEN_HEIGHT - 1) + x] = 0;
			}
			vramDirty = true;
			break;
		case 1: case 29: // 右
			for (let y = 0; y < SCREEN_HEIGHT; y++) {
				for (let x = SCREEN_WIDTH - 1; x > 0; x--) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * y + (x - 1)];
				}
				vramView[SCREEN_WIDTH * y] = 0;
			}
			vramDirty = true;
			break;
		case 2: case 31: // 下
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				for (let y = SCREEN_HEIGHT - 1; y > 0; y--) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * (y - 1) + x];
				}
				vramView[x] = 0;
			}
			vramDirty = true;
			break;
		case 3: case 28: // 左
			for (let y = 0; y < SCREEN_HEIGHT; y++) {
				for (let x = 0; x < SCREEN_WIDTH - 1; x++) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * y + (x + 1)];
				}
				vramView[SCREEN_WIDTH * y + (SCREEN_WIDTH - 1)] = 0;
			}
			vramDirty = true;
			break;
	}
}

function commandNEXT() {
	// 対応するFORの処理に飛ぶ
	if (forStack.length === 0) throw "Not match";
	const destination = forStack[forStack.length - 1];
	forStack.push([currentLine, currentPositionInLine + 1]);
	return destination;
}

function commandGOSUB(args) {
	// 戻る場所を記録して指定の行に飛ぶ
	if (prgDirty) compileProgram();
	if (args[0] > 0 && (args[0] in programs)) {
		gosubStack.push([currentLine, currentPositionInLine + 1]);
		return [args[0], 0];
	} else {
		throw "Line error";
	}
}

function commandRETURN() {
	// 記録した場所に戻る
	if (gosubStack.length === 0) throw "Not match";
	return gosubStack.pop();
}

function commandPOKE(args) {
	// 仮想メモリにデータを書き込む
	for (let i = 1; i < args.length; i++) {
		writeVirtualMem(args[0] + i - 1, args[i]);
	}
}

function commandHELP() {
	// メモリマップを出力する
	putString("#000 CHAR\n");
	putString("#" + (VIRTUAL_RAM_OFFSET + CRAM_ADDR).toString(16).toUpperCase() + " PCG\n");
	putString("#" + (VIRTUAL_RAM_OFFSET + ARRAY_ADDR).toString(16).toUpperCase() + " VAR\n");
	putString("#" + (VIRTUAL_RAM_OFFSET + VRAM_ADDR).toString(16).toUpperCase() + " VRAM\n");
	putString("#" + (VIRTUAL_RAM_OFFSET + PRG_ADDR).toString(16).toUpperCase() + " LIST\n");
}

function commandCOPY(args) {
	// 仮想メモリ中のデータのコピーを行う
	const dest = args[0], src = args[1], amount = args[2];
	if (amount >= 0) {
		for (let i = 0; i < amount; i++) {
			writeVirtualMem(dest + i, readVirtualMem(src + i));
		}
	} else {
		for (let i = 0; i > amount; i--) {
			writeVirtualMem(dest + i, readVirtualMem(src + i));
		}
	}
}
