"use strict";

async function commandINPUT(prompt, varIdx) {
	if (cursorY < 0) {
		throw "Not match";
	}
	putString(prompt);
	const startX = cursorX, startY = cursorY;
	for (;;) {
		pollBreak();
		const key = dequeueKey();
		switch (key) {
			case -1:
				// 入力されていない
				updateScreen();
				await new Promise(function(resolve, reject) {
					inputKeyBlockCallback = function() {
						inputKeyBlockCallback = null;
						resolve();
					};
					keyBlocked = true;
				});
				break;
			case 0x08:
				// Backspace
				if (cursorX !== startX) putChar(0x08);
				break;
			case 0x0a:
				// Enter
				{
					const addr = VRAM_ADDR + SCREEN_WIDTH * startY + startX;
					let exprStr = "";
					for (let i = addr; i < ramBytes.length && ramBytes[i] !== 0; i++) {
						exprStr += String.fromCharCode(ramBytes[i]);
					}
					const tokens = lexer(exprStr, VIRTUAL_RAM_OFFSET + addr);
					// エラーが出たら最後のトークンを削ってリトライする
					// たとえば、100/0 が入力されたとき 100 を格納するのに有効
					while (tokens.length > 0) {
						const ast = parser.parseExpr(tokens, true);
						if (ast !== null) {
							const executable = compiler.compileExpr(ast);
							try {
								const ret = await executable();
								writeArray(varIdx, ret);
								putChar(0x0a);
								return;
							} catch(e) {
							}
						}
						tokens.pop();
					}
					// 何も有効な入力が無かった場合、0 を格納する
					writeArray(varIdx, 0);
					putChar(0x0a);
					return;
				}
				break;
			case 0x1c:
				// カーソルを左に移動
				if (cursorX !== startX) {
					if (cursorX === 0) {
						if (cursorY > 0) {
							cursorY--;
							cursorX = SCREEN_WIDTH - 1;
						}
					} else {
						cursorX--;
					}
				}
				break;
			case 0x1d:
				// カーソルを右に移動
				if (cursorX === SCREEN_WIDTH - 1) {
					if (cursorY < SCREEN_HEIGHT - 1) {
						cursorY++;
						cursorX = 0;
					}
				} else {
					cursorX++;
				}
				break;
			case 0x1e:
				// カーソルを上に移動
				// 無視
				break;
			case 0x1f:
				// カーソルを下に移動
				// 無視
				break;
			default:
				putChar(key);
				break;
		}
	}
}

function commandLED(args) {
	// LEDの点灯/消灯を切り替える
	const isOn = args[0] !== 0;
	const ledElement = document.getElementById("ledPane");
	if (isOn) {
		ledElement.classList.add("lighting");
	} else {
		ledElement.classList.remove("lighting");
	}
}

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

async function commandBEEP(args) {
	// ビープ音を出す
	const kind = args.length > 0 ? args[0] : 10;
	const length = args.length > 1 ? args[1] : 3;
	const lengthMs = length <= 0 ? -1 : 1000 * length / 60;
	if (kind === 0) {
		await soundManager.stop();
	} else {
		const trueKind = kind < 0 ? kind + 65536 : kind;
		await soundManager.beep(8000 / trueKind, lengthMs);
	}
}

async function commandPLAY(args) {
	// MMLを再生する
	if (args.length > 0) {
		let mml = "";
		for (let addr = args[0]; ; addr++) {
			const c = readVirtualMem(addr);
			if (c === 0 || c === 0x22) break;
			mml += String.fromCharCode(c);
		}
		await soundManager.play(mml, document.getElementById("systemMMLInterpretationSelect").value === "old");
	} else {
		await soundManager.stop();
	}
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

function commandNEXT(args, nextPos) {
	// 対応するFORの処理に飛ぶ
	if (forStack.length === 0) throw "Not match";
	const destination = forStack[forStack.length - 1];
	forStack.push(nextPos);
	return destination;
}

function commandGOSUB(args, nextPos) {
	// 戻る場所を記録して指定の行に飛ぶ
	if (prgDirty) compileProgram();
	if (args[0] > 0 && (args[0] in programs)) {
		gosubStack.push(nextPos);
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

function commandSTOP() {
	// プログラムの実行を止める
	throw "Stopped";
}

function commandCONT() {
	// 前回エラーが出た行からプログラムを実行する (インタラクティブ時)
	// 現在の行の先頭から実行する (保存したプログラムの実行時)
	if (currentLine <= 0) {
		if (prgDirty) compileProgram();
		if (lastErrorLine in programs) {
			return [lastErrorLine, 0];
		} else {
			throw "Line error";
		}
	} else {
		return [currentLine, 0];
	}
}

function commandVIDEO(args) {
	// 画面の表示設定を変更する
	const config = args[0];
	if (config < 0) {
		// 本家では動作異常を起こすが、無視する
	} else if (config === 0) {
		// 非表示
		// TODO
	} else {
		const newVideoZoom = config <= 8 ? 1 << ((config - 1) >>> 1) : 8;
		const newVideoInvert = (config & 1) === 0;
		if (videoInvert !== newVideoInvert) videoConfigUpdated = true;
		SCREEN_WIDTH = RAW_SCREEN_WIDTH / newVideoZoom;
		SCREEN_HEIGHT = RAW_SCREEN_HEIGHT / newVideoZoom;
		if (newVideoZoom !== videoZoom) commandCLS();
		videoZoom = newVideoZoom;
		videoInvert = newVideoInvert;
	}
	// TODO: クロックダウン設定の反映
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

function commandRESET() {
	// システムをリセットする
	resetSystem();
	return [currentLine, currentPositionInLine];
}

function commandSRND(args) {
	// 乱数の種を設定する
	randomSeeded = true;
	seededX = args[0];
	seededY = 362436069;
	seededZ = 521288629;
	seededW = 88675123;
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

function commandOK(args) {
	// メッセージの表示モードを設定する
	okMode = args.length > 0 ? args[0] : 1;
}

function commandDRAW(args) {
	// 点または線を描画する
	// modeの仕様 (観察結果)
	// 0: 描画する位置の点を消す
	// 1: 描画する位置に点を出す
	// 2: 描画する位置の点をトグルする (#80台以外は点が無い扱い)
	// 3: 何もしない
	// その他？: 描画する位置の点は変更せず、#80台以外なら#80にする
	const mode = args.length % 2 === 0 ? 1 : args[args.length - 1];
	const drawPoint = function(x, y) {
		if(x < 0 || SCREEN_WIDTH * 2 <= x || y < 0 || SCREEN_HEIGHT * 2 <= y) return;
		if(mode === 3) return;
		const idx = SCREEN_WIDTH * (y >> 1) + (x >> 1);
		const offset = 2 * (y & 1) + (x & 1);
		if ((vramView[idx] & 0xf0) !== 0x80) vramView[idx] = 0x80;
		switch (mode) {
			case 0: vramView[idx] &= ~(1 << offset); break;
			case 1: vramView[idx] |= 1 << offset; break;
			case 2: vramView[idx] ^= 1 << offset; break;
		}
		vramDirty = true;
	};
	// プレゼンハムのアルゴリズム
	const sx = args[0], sy = args[1];
	const dx = args.length >= 4 ? args[2] : args[0];
	const dy = args.length >= 4 ? args[3] : args[1];
	const wx = sx >= dx ? sx - dx : dx - sx, wy = sy >= dy ? sy - dy : dy - sy;
	const xmode = wx >= wy;
	let x = sx, y = sy, gosa = 0;
	while (x != dx || y != dy) {
		drawPoint(x, y);
		if (xmode) {
			if (sx < dx) x++; else x--;
			gosa += (dy - sy) << 1;
			if (gosa > wx){
				y++;
				gosa -= wx << 1;
			} else if (gosa < -wx) {
				y--;
				gosa += wx << 1;
			}
		} else {
			if (sy < dy) y++; else y--;
			gosa += (dx - sx) << 1;
			if (gosa > wy) {
				x++;
				gosa -= wy << 1;
			} else if (gosa < -wy) {
				x--;
				gosa += wy << 1;
			}
		}
	}
	drawPoint(x, y);
}

async function commandSEC_PUBKEY(args) {
	// Ed25519の秘密鍵から公開鍵を求める
	// args[0] : 公開鍵(出力)の仮想アドレス
	// args[1] : 秘密鍵(入力)の仮想アドレス
	const privateKey = new Uint8Array(32);
	for (let i = 0; i < 32; i++) privateKey[i] = readVirtualMem(args[1] + i);
	const publicKey = new Uint8Array(await ed25519.getPublicKey(privateKey));
	for (let i = 0; i < 32; i++) writeVirtualMem(args[0] + i, publicKey[i]);
}

async function commandSEC_SIGN(args) {
	// Ed25519の署名を生成する
	// args[0] : 署名(出力)の仮想アドレス
	// args[1] : 秘密鍵(入力)の仮想アドレス
	// args[2] : メッセージ(入力)の仮想アドレス
	// args[3] : メッセージ(入力)の長さ (0未満の場合は0とみなす)
	const privateKey = new Uint8Array(32);
	for (let i = 0; i < 32; i++) privateKey[i] = readVirtualMem(args[1] + i);
	const message = new Uint8Array(args[3] < 0 ? 0 : args[3]);
	for (let i = 0; i < args[3]; i++) message[i] = readVirtualMem(args[2] + i);
	const sign = new Uint8Array(await ed25519.sign(message, privateKey));
	for (let i = 0; i < 64; i++) writeVirtualMem(args[0] + i, sign[i]);
}
