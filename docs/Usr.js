"use strict";

async function functionUSR_M0(args) {
	// マシン語 (M0) のプログラムを実行する
	const startVirtualAddress = args[0];
	const startArgument = args.length >= 2 ? args[1] : 0;
	if (startVirtualAddress < 0x700 || 0x1180 <= startVirtualAddress) {
		throw "Illegal argument";
	}

	// レジスタの定義
	const regs = new Uint32Array(16);
	const SP_IDX = 13, LR_IDX = 14, PC_IDX = 15;
	let flags = 0;
	const FLAG_N = 8, FLAG_Z = 4, FLAG_C = 2, FLAG_V = 1;
	const FLAG_ALL = FLAG_N | FLAG_Z | FLAG_C | FLAG_V;
	let primask = 0, control = 0, anotherStack = 0;

	const segFault = function(cause) {
		console.warn(cause + " at 0x" + regs[PC_IDX].toString(16));
		throw "Segmentation Fault";
	};

	const unknownInstruction = function(opCode, opCode2) {
		let opCodeHex = opCode.toString(16);
		while (opCodeHex.length < 4) opCodeHex = "0" + opCodeHex;
		let message = "unknown instruction 0x" + opCodeHex;
		if (typeof opCode2 !== "undefined") {
			let opCodeHex2 = opCode2.toString(16);
			while (opCodeHex2.length < 4) opCodeHex2 = "0" + opCodeHex2;
			message += ", 0x" + opCodeHex2;
		}
		segFault(message);
	}

	// メモリマップの定義
	const ROM_START_ADDRESS = 0x00000000;
	const RAM_START_ADDRESS = 0x10000000;

	// メモリアクセス用関数

	const readMemory = function(address, size, signed = false) {
		if (address % size !== 0) {
			segFault("unaligned memory read");
		}
		let res = 0;
		if (ROM_START_ADDRESS <= address && address + size <= ROM_START_ADDRESS + romBytes.length) {
			for (let i = 0; i < size; i++) {
				res |= romBytes[address - ROM_START_ADDRESS + i] << (8 * i);
			}
		} else if (RAM_START_ADDRESS <= address && address + size <= RAM_START_ADDRESS + ramBytes.length) {
			for (let i = 0; i < size; i++) {
				res |= ramBytes[address - RAM_START_ADDRESS + i] << (8 * i);
			}
		} else {
			segFault("invalid memory read");
		}
		if (signed) {
			if (size >= 4) res = res >> 0;
			else if (res & (1 << (8 * size - 1))) res |= (~0 << (8 * size));
		} else {
			res = res >>> 0;
		}
		return res;
	};

	const writeMemory = function(address, size, value) {
		if (address % size !== 0) {
			segFault("unaligned memory write");
		}
		if (RAM_START_ADDRESS <= address && address + size <= RAM_START_ADDRESS + ramBytes.length) {
			for (let i = 0; i < size; i++) {
				ramBytes[address - RAM_START_ADDRESS + i] = (value >> (8 * i)) & 0xff;
			}
		} else {
			segFault("invalid memory write");
		}
	};

	// 実行補助用関数

	const signExtend = function(value, numBits) {
		if (value & (1 << (numBits - 1))) {
			return -((value ^ ((1 << numBits) - 1)) + 1);
		} else {
			return value;
		}
	};

	const add = function(a, b, extra = 0) {
		const a2 = a >> 0, b2 = b >> 0;
		const ret = a2 + b2 + extra;
		const ret32 = ret >> 0;
		let resultFlag = 0;
		if (ret32 < 0) resultFlag |= FLAG_N;
		if (ret32 === 0) resultFlag |= FLAG_Z;
		if ((a >>> 0) + (b >>> 0) + extra > 0xffffffff) resultFlag |= FLAG_C;
		if (ret !== ret32) resultFlag |= FLAG_V;
		return {
			"result": ret32 >>> 0,
			"flag": resultFlag,
			"flagMask": FLAG_ALL,
		};
	};

	const addWithCarryFlag = function(a, b) {
		return add(a, b, flags & FLAG_C ? 1 : 0);
	};

	const sub = function(a, b, extra = 0) {
		const a2 = a >> 0, b2 = b >> 0;
		const ret = a2 - (b2 + extra);
		const ret32 = ret >> 0;
		let resultFlag = 0;
		if (ret32 < 0) resultFlag |= FLAG_N;
		if (ret32 === 0) resultFlag |= FLAG_Z;
		if ((a2 >>> 0) >= (b2 >>> 0) + extra) resultFlag |= FLAG_C;
		if (ret !== ret32) resultFlag |= FLAG_V;
		return {
			"result": ret32 >>> 0,
			"flag": resultFlag,
			"flagMask": FLAG_ALL,
		};
	};

	const subWithCarryFlag = function(a, b) {
		return sub(a, b, flags & FLAG_C ? 0 : 1);
	};

	const shiftLeft = function(a, b) {
		const a2 = a >>> 0, b2 = b >>> 0;
		if (b2 >= 32) {
			return {
				"result": 0,
				"flag": FLAG_Z | (b2 === 32 && (a2 & 1) ? FLAG_C : 0),
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		} else if (b2 === 0) {
			return {
				"result": a2,
				"flag": (a2 & 0x80000000 ? FLAG_N : 0) | (a2 === 0 ? FLAG_Z : 0),
				"flagMask": FLAG_N | FLAG_Z,
			};
		} else {
			const res = (a2 << b2) >>> 0;
			const carry = (a2 << (b2 - 1)) & 0x80000000;
			let resultFlag = 0;
			if (res & 0x80000000) resultFlag |= FLAG_N;
			if (res === 0) resultFlag |= FLAG_Z;
			if (carry) resultFlag |= FLAG_C;
			return {
				"result": res,
				"flag": resultFlag,
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		}
	};

	const logicalShiftRight = function(a, b) {
		const a2 = a >>> 0, b2 = b >>> 0;
		if (b2 >= 32) {
			return {
				"result": 0,
				"flag": FLAG_Z | (b2 === 32 && (a2 & 0x80000000) ? FLAG_C : 0),
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		} else if (b2 === 0) {
			return {
				"result": a2,
				"flag": (a2 & 0x80000000 ? FLAG_N : 0) | (a2 === 0 ? FLAG_Z : 0),
				"flagMask": FLAG_N | FLAG_Z,
			};
		} else {
			const res = a2 >>> b2;
			const carry = (a2 >>> (b2 - 1)) & 1;
			let resultFlag = 0;
			if (res & 0x80000000) resultFlag |= FLAG_N;
			if (res === 0) resultFlag |= FLAG_Z;
			if (carry) resultFlag |= FLAG_C;
			return {
				"result": res,
				"flag": resultFlag,
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		}
	};

	const arithmeticShiftRight = function(a, b) {
		const a2 = a >>> 0, b2 = b >>> 0;
		if (b2 >= 32) {
			return {
				"result": a2 & 0x80000000 ? 0xffffffff : 0,
				"flag": FLAG_Z | ((a2 & 0x80000000) ? FLAG_C : 0),
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		} else if (b2 === 0) {
			return {
				"result": a2,
				"flag": (a2 & 0x80000000 ? FLAG_N : 0) | (a2 === 0 ? FLAG_Z : 0),
				"flagMask": FLAG_N | FLAG_Z,
			};
		} else {
			const res = a2 >> b2;
			const carry = (a2 >> (b2 - 1)) & 1;
			let resultFlag = 0;
			if (res & 0x80000000) resultFlag |= FLAG_N;
			if (res === 0) resultFlag |= FLAG_Z;
			if (carry) resultFlag |= FLAG_C;
			return {
				"result": res,
				"flag": resultFlag,
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		}
	};

	const rotateRight = function(a, b) {
		const a2 = a >>> 0, b2 = b >>> 0;
		if (b2 === 0) {
			return {
				"result": a2,
				"flag": (a2 & 0x80000000 ? FLAG_N : 0) | (a2 === 0 ? FLAG_Z : 0),
				"flagMask": FLAG_N | FLAG_Z,
			};
		} else {
			const width = b2 & 0x1f;
			const res = width === 0 ? a2 : ((a2 >>> width) | (a2 << (32 - width))) >>> 0;
			const carry = (a2 >>> (width === 0 ? 31 : width - 1)) & 1;
			let resultFlag = 0;
			if (res & 0x80000000) resultFlag |= FLAG_N;
			if (res === 0) resultFlag |= FLAG_Z;
			if (carry) resultFlag |= FLAG_C;
			return {
				"result": res,
				"flag": resultFlag,
				"flagMask": FLAG_N | FLAG_Z | FLAG_C,
			};
		}
	};

	const calculateAndUpdateFlag = function(func, a, b) {
		const res = func(a, b);
		flags = (flags & ~res.flagMask) | (res.flag & res.flagMask);
		return res.result;
	};

	const setNegativeAndZeroFlag = function(value) {
		const res = value >>> 0;
		if (res & 0x80000000) flags |= FLAG_N; else flags &= ~FLAG_N;
		if (res === 0) flags |= FLAG_Z; else flags &= ~FLAG_Z;
		return res;
	};

	// 実行の初期化
	const RETURN_ADDRESS = 0x2000, DIVIDE_FUNC = 0x2002;
	regs[0] = signExtend(startArgument, 16) >>> 0;
	regs[1] = (RAM_START_ADDRESS + CRAM_ADDR - 0x700) >>> 0;
	regs[2] = (ROM_START_ADDRESS + CROM_ADDR) >>> 0;
	regs[3] = DIVIDE_FUNC | 1;
	regs[SP_IDX] = RAM_START_ADDRESS + ramBytes.length - 32;
	regs[LR_IDX] = RETURN_ADDRESS | 1;
	regs[PC_IDX] = RAM_START_ADDRESS + CRAM_ADDR + startVirtualAddress - 0x700;

	// 実行
	let startTime = performance.now();
	for (;;) {
		if (performance.now() - startTime >= 20) {
			updateScreen();
			await new Promise(function(resolve, reject) {
				doCallback(resolve);
			});
			startTime = performance.now();
		}
		if (regs[PC_IDX] === RETURN_ADDRESS) {
			return signExtend(regs[0] & 0xffff, 16);
		} else if (regs[PC_IDX] === DIVIDE_FUNC) {
			if (regs[1] === 0) {
				regs[0] = 0;
				regs[1] = 0;
			} else {
				const q = (regs[0] / regs[1]) >>> 0;
				const r = (regs[0] % regs[1]) >>> 0;
				regs[0] = q;
				regs[1] = r;
			}
			regs[PC_IDX] = (regs[LR_IDX] & ~1) >>> 0;
			continue;
		}
		const opCode = readMemory(regs[PC_IDX], 2, false);
		let nextPC = (regs[PC_IDX] + 2) >>> 0;

		const u8 = opCode & 0xff;
		const u5 = (opCode >> 6) & 0x1f;
		const R03 = opCode & 7;
		const R04 = (opCode & 7) | ((opCode >> 4) & 8);
		const R33 = (opCode >> 3) & 7;
		const R34 = (opCode >> 3) & 0xf;
		const R63 = (opCode >> 6) & 7;
		const R83 = (opCode >> 8) & 7;

		switch (opCode >> 11) {
			case 0x00:
				// Rd = Rm << u5
				regs[R03] = calculateAndUpdateFlag(shiftLeft, regs[R33], u5);
				break;
			case 0x01:
				// Rd = Rm >> u5
				regs[R03] = calculateAndUpdateFlag(logicalShiftRight, regs[R33], u5);
				break;
			case 0x02:
				// Rd = ASR(Rm, u5)
				regs[R03] = calculateAndUpdateFlag(arithmeticShiftRight, regs[R33], u5);
				break;
			case 0x03:
				// opCode[10:9]
				// 00 : Rd = Rn + Rm
				// 01 : Rd = Rn - Rm
				// 10 : Rd = Rn + u3
				// 11 : Rd = Rn - u3
				regs[R03] = calculateAndUpdateFlag(opCode & (1 << 9) ? sub : add, regs[R33],
					opCode & (1 << 10) ? R63 : regs[R63]);
				break;
			case 0x04:
				// Rd = u8
				regs[R83] = setNegativeAndZeroFlag(u8);
				break;
			case 0x05:
				// Rn - u8
				calculateAndUpdateFlag(sub, regs[R83], u8);
				break;
			case 0x06:
				// Rd += u8
				regs[R83] = calculateAndUpdateFlag(add, regs[R83], u8);
				break;
			case 0x07:
				// Rd -= u8
				regs[R83] = calculateAndUpdateFlag(sub, regs[R83], u8);
				break;
			case 0x08:
				if (opCode & (1 << 10)) {
					switch ((opCode >> 8) & 3) {
						case 0:
							// Rd += Rm
							if (R04 === PC_IDX && R34 === PC_IDX) {
								segFault("PC += PC is not allowed");
							}
							if (R04 === PC_IDX) {
								nextPC = ((regs[PC_IDX] + 4 + regs[R34]) & ~1) >>> 0;
							} else {
								regs[R04] = (regs[R04] + regs[R34] + (R34 === PC_IDX ? 4 : 0)) >>> 0;
							}
							break;
						case 1:
							// Rn - Rm
							if (R04 === PC_IDX || R34 === PC_IDX) {
								segFault("PC is not allowed in CMP");
							}
							calculateAndUpdateFlag(sub, regs[R04], regs[R34]);
							break;
						case 2:
							// Rd = Rm
							{
								let value = (regs[R34] + (R34 === PC_IDX ? 4 : 0)) >>> 0;
								if (R04 === PC_IDX) value = (value & ~1) >>> 0;
								regs[R04] = value;
							}
							break;
						case 3:
							if ((opCode & 7) === 0) {
								// GOTO Rm / GOSUB Rm
								if (R34 === SP_IDX || R34 === PC_IDX) {
									segFault("SP/PC is not allowed in BX/BLX");
								}
								if (opCode & (1 << 7)) {
									// GOSUB Rm
									regs[LR_IDX] = nextPC | 1;
								}
								if (!(regs[R34] & 1)) {
									segFault("LSB of destination is 0 in BX/BLX");
								}
								nextPC = (regs[R34] & ~1) >>> 0;
							} else {
								unknownInstruction(opCode);
							}
							break;
					}
				} else {
					switch ((opCode >> 6) & 0xf) {
						case 0:
							// Rd &= Rm
							regs[R03] = setNegativeAndZeroFlag(regs[R03] & regs[R33]);
							break;
						case 1:
							// Rd ^= Rm
							regs[R03] = setNegativeAndZeroFlag(regs[R03] ^ regs[R33]);
							break;
						case 2:
							// Rd <<= Rs
							regs[R03] = calculateAndUpdateFlag(shiftLeft, regs[R03], regs[R33]);
							break;
						case 3:
							// Rd >>= Rs
							regs[R03] = calculateAndUpdateFlag(logicalShiftRight, regs[R03], regs[R33]);
							break;
						case 4:
							// ASR Rd, Rs
							regs[R03] = calculateAndUpdateFlag(arithmeticShiftRight, regs[R03], regs[R33]);
							break;
						case 5:
							// Rd += Rm + C
							regs[R03] = calculateAndUpdateFlag(addWithCarryFlag, regs[R03], regs[R33]);
							break;
						case 6:
							// Rd -= Rd + !C
							regs[R03] = calculateAndUpdateFlag(subWithCarryFlag, regs[R03], regs[R33]);
							break;
						case 7:
							// ROR Rd, Rs
							regs[R03] = calculateAndUpdateFlag(rotateRight, regs[R03], regs[R33]);
							break;
						case 8:
							// Rn & Rm
							setNegativeAndZeroFlag(regs[R03] & regs[R33]);
							break;
						case 9:
							// Rd = -Rm
							regs[R03] = calculateAndUpdateFlag(sub, 0, regs[R33]);
							break;
						case 10:
							// Rn - Rm
							calculateAndUpdateFlag(sub, regs[R03], regs[R33]);
							break;
						case 11:
							// Rn + Rm
							calculateAndUpdateFlag(add, regs[R03], regs[R33]);
							break;
						case 12:
							// Rd |= Rm
							regs[R03] = setNegativeAndZeroFlag(regs[R03] | regs[R33]);
							break;
						case 13:
							// Rd *= Rm
							{
								const a = regs[R03], b = regs[R33];
								let result;
								result = a * (b >>> 16) & 0xffff;
								result = (result & 0xffff) << 16;
								result = result + a * (b & 0xffff);
								regs[R03] = setNegativeAndZeroFlag(result);
							}
							break;
						case 14:
							// BIC Rd, Rm
							regs[R03] = setNegativeAndZeroFlag(regs[R03] & ~regs[R33]);
							break;
						case 15:
							// Rd = ~Rm
							regs[R03] = setNegativeAndZeroFlag(~regs[R33]);
							break;
					}
				}
				break;
			case 0x09:
				// Rd = [PC + u8]L
				regs[R83] = readMemory((((regs[PC_IDX] + 4) & ~3) + 4 * u8) >>> 0, 4, false);
				break;
			case 0x0A:
				{
					const address = (regs[R33] + regs[R63]) >>> 0;
					switch ((opCode >> 9) & 3) {
						case 0:
							// [Rn + Rm]L = Rd
							writeMemory(address, 4, regs[R03]);
							break;
						case 1:
							// [Rn + Rm]W = Rd
							writeMemory(address, 2, regs[R03]);
							break;
						case 2:
							// [Rn + Rm] = Rd
							writeMemory(address, 1, regs[R03]);
							break;
						case 3:
							// Rd = [Rn + Rm]C
							regs[R03] = readMemory(address, 1, true) >>> 0;
							break
					}
				}
				break;
			case 0x0B:
				{
					const address = (regs[R33] + regs[R63]) >>> 0;
					switch ((opCode >> 9) & 3) {
						case 0:
							// Rd = [Rn + Rm]L
							regs[R03] = readMemory(address, 4, false);
							break;
						case 1:
							// Rd = [Rn + Rm]W
							regs[R03] = readMemory(address, 2, false);
							break;
						case 2:
							// Rd = [Rn + Rm]
							regs[R03] = readMemory(address, 1, false);
							break;
						case 3:
							// Rd = [Rn + Rm]S
							regs[R03] = readMemory(address, 2, true) >>> 0;
							break;
					}
				}
				break;
			case 0x0C:
				// [Rn + u5]L = Rd
				writeMemory((regs[R33] + 4 * u5) >>> 0, 4, regs[R03]);
				break;
			case 0x0D:
				// Rd = [Rn + u5]L
				regs[R03] = readMemory((regs[R33] + 4 * u5) >>> 0, 4, false);
				break;
			case 0x0E:
				// [Rn + u5] = Rd
				writeMemory((regs[R33] + u5) >>> 0, 1, regs[R03]);
				break;
			case 0x0F:
				// Rd = [Rn + u5]
				regs[R03] = readMemory((regs[R33] + u5) >>> 0, 1, false);
				break;
			case 0x10:
				// [Rn + u5]W = Rd
				writeMemory((regs[R33] + 2 * u5) >>> 0, 2, regs[R03]);
				break;
			case 0x11:
				// Rd = [Rn + u5]W
				regs[R03] = readMemory((regs[R33] + 2 * u5) >>> 0, 2, false);
				break;
			case 0x12:
				// [SP + u8]L = Rd
				writeMemory((regs[SP_IDX] + 4 * u8) >>> 0, 4, regs[R83]);
				break;
			case 0x13:
				// Rd = [SP + u8]L
				regs[R83] = readMemory((regs[SP_IDX] + 4 * u8) >>> 0, 4, false);
				break;
			case 0x14:
				// Rd = PC + u8
				regs[R83] = (((regs[PC_IDX] + 4) & ~3) + 4 * u8) >>> 0;
				break;
			case 0x15:
				// Rd = SP + u8
				regs[R83] = (regs[SP_IDX] + 4 * u8) >>> 0;
				break;
			case 0x16:
				switch ((opCode >> 8) & 7) {
					case 0:
						if (opCode & (1 << 7)) {
							// SP -= u7
							regs[SP_IDX] = (regs[SP_IDX] - 4 * (opCode & 0x7f)) >>> 0;
						} else {
							// SP += u7
							regs[SP_IDX] = (regs[SP_IDX] + 4 * (opCode & 0x7f)) >>> 0;
						}
						break;
					case 2:
						switch ((opCode >> 6) & 3) {
							case 0:
								// Rd = SXTH(Rm)
								regs[R03] = ((regs[R33] & 0xffff) | (regs[R33] & 0x8000 ? 0xffff0000 : 0)) >>> 0;
								break;
							case 1:
								// Rd = SXTB(Rm)
								regs[R03] = ((regs[R33] & 0xff) | (regs[R33] & 0x80 ? 0xffffff00 : 0)) >>> 0;
								break;
							case 2:
								// Rd = UXTH(Rm)
								regs[R03] = regs[R33] & 0xffff;
								break;
							case 3:
								// Rd = UXTB(Rm)
								regs[R03] = regs[R33] & 0xff;
								break;
						}
						break;
					case 5:
						// PUSH {regs}
						// 保存対象にLRを含む場合
						regs[SP_IDX] = (regs[SP_IDX] - 4) >>> 0;
						writeMemory(regs[SP_IDX], 4, regs[LR_IDX]);
					case 4:
						// PUSH {regs}
						for (let i = 7; i >= 0; i--) {
							if ((opCode >> i) & 1) {
								regs[SP_IDX] = (regs[SP_IDX] - 4) >>> 0;
								writeMemory(regs[SP_IDX], 4, regs[i]);
							}
						}
						break;
					case 6:
						if (opCode === 0xB672) {
							// CPSID
							primask = 1;
						} else if (opCode === 0xB662) {
							// CPSIE
							primask = 0;
						} else {
							unknownInstruction(opCode);
						}
						break;
					default: // case 1, case 3, case 7
						unknownInstruction(opCode);
						break;
				}
				break;
			case 0x17:
				switch ((opCode >> 8) & 7) {
					case 2:
						switch ((opCode >> 6) & 3) {
							case 0:
								// Rd = REV(Rm)
								{
									const v = regs[R33];
									regs[R03] = (((v & 0xff) << 24) | ((v & 0xff00) << 8) | ((v & 0xff0000) >>> 8) | ((v & 0xff000000) >>> 24)) >>> 0;
								}
								break;
							case 1:
								// Rd = REV16(Rm)
								{
									const v = regs[R33];
									regs[R03] = (((v & 0x00ff00ff) << 8) | ((v & 0xff00ff00) >>> 8)) >>> 0;
								}
								break;
							case 2:
								unknownInstruction(opCode);
								break;
							case 3:
								// Rd = REVSH(Rm)
								{
									const v = regs[R33];
									regs[R03] = (((v & 0xff) << 8) | ((v & 0xff00) >>> 8) | (v & 0x80 ? 0xffff0000 : 0)) >>> 0;
								}
								break;
						}
						break;
					case 4: case 5:
						// POP {regs}
						for (let i = 0; i < 8; i++) {
							if ((opCode >> i) & 1) {
								regs[i] = readMemory(regs[SP_IDX], 4, false);
								regs[SP_IDX] = (regs[SP_IDX] + 4) >>> 0;
							}
						}
						if (opCode & (1 << 8)) {
							// 復帰対象にPCを含む場合
							nextPC = readMemory(regs[SP_IDX], 4, false);
							regs[SP_IDX] = (regs[SP_IDX] + 4) >>> 0;
							if (!(nextPC & 1)) {
								segFault("LSB of popped PC is 0");
							}
							nextPC = (nextPC & ~1) >>> 0;
						}
						break;
					case 6:
						// BKPT
						// 何もしない
						break;
					case 7:
						switch (opCode & 0xff) {
							case 0x30:
								// WFI
								// 何もしない
								break;
							case 0x10:
								// YIELD
								// 何もしない
								break;
							case 0x20:
								// WFE
								// 何もしない
								break;
							case 0x40:
								// SEV
								// 何もしない
								break;
							default:
								unknownInstruction(opCode);
								break;
						}
						break;
					default: // case 1, case 3
						unknownInstruction(opCode);
						break;
				}
				break;
			case 0x18:
				// STM Rn, {regs}
				{
					let address = regs[R83];
					for (let i = 0; i < 8; i++) {
						if ((opCode >> i) & 1) {
							writeMemory(address, 4, regs[i]);
							address = (address + 4) >>> 0;
						}
					}
					regs[R83] = address;
				}
				break;
			case 0x19:
				// LDM Rn, {regs}
				{
					let address = regs[R83];
					for (let i = 0; i < 8; i++) {
						if ((opCode >> i) & 1) {
							regs[i] = readMemory(address, 4, false);
							address = (address + 4) >>> 0;
						}
					}
					if (!((opCode >> R83) & 1)) {
						regs[R83] = address;
					}
				}
				break;
			case 0x1A: case 0x1B:
				// IF cond GOTO n8
				{
					let cond = false;
					switch ((opCode >> 8) & 0xf) {
						case 0: cond = flags & FLAG_Z; break; // EQ
						case 1: cond = !(flags & FLAG_Z); break; // NE
						case 2: cond = flags & FLAG_C; break; // CS
						case 3: cond = !(flags & FLAG_C); break; // CC
						case 4: cond = flags & FLAG_N; break; // MI
						case 5: cond = !(flags & FLAG_N); break; // PL
						case 6: cond = flags & FLAG_V; break; // VS
						case 7: cond = !(flags & FLAG_V); break; //VC
						case 8: cond = !(flags & FLAG_Z) && (flags & FLAG_C); break; // HI
						case 9: cond = (flags & FLAG_Z) || !(flags & FLAG_C); break; // LS
						case 10: cond = !(flags & FLAG_N) === !(flags & FLAG_V); break; // GE
						case 11: cond = !(flags & FLAG_N) !== !(flags & FLAG_V); break; // LT
						case 12: cond = !(flags & FLAG_Z) && !(flags & FLAG_N) === !(flags & FLAG_V); break; // GT
						case 13: cond = (flags & FLAG_Z) || !(flags & FLAG_N) !== !(flags & FLAG_V); break; // LE
						case 14: cond = false; break; // Unused Opcode
						case 15: cond = false; break; // SWI
					}
					if (cond) {
						nextPC = (regs[PC_IDX] + 4 + 2 * signExtend(opCode & 0xff, 8)) >>> 0;
					}
				}
				break;
			case 0x1C:
				// GOTO n11
				nextPC = (regs[PC_IDX] + 4 + 2 * signExtend(opCode & 0x7ff, 11)) >>> 0;
				break;
			case 0x1D:
				unknownInstruction(opCode);
				break;
			case 0x1E:
				{
					const n22upper = opCode & 0x7ff;
					const opCode2 = readMemory(nextPC, 2, false);
					nextPC = (nextPC + 2) >>> 0;
					if (((opCode2 >> 11) & 0x1f) === 0x1f) {
						// GOSUB n22
						const offset = signExtend((n22upper << 11) | (opCode2 & 0x7ff), 22);
						regs[LR_IDX] = nextPC | 1;
						nextPC = (regs[PC_IDX] + 4 + 2 * offset) >>> 0;
					} else if (((opCode2 >> 12) & 0xf) === 0x8) {
						if (opCode === 0xF3DF) {
							switch (opCode2) {
								case 0x8F5F:
									// DMB
									// 何もしない
									break;
								case 0x8F4F:
									// DSB
									// 何もしない
									break;
								case 0x8F6F:
									// ISB
									// 何もしない
									break;
								default:
									unknownInstruction(opCode, opCode2);
									break;
							}
						} else if (opCode === 0xF3EF) {
							// Rd = spec_reg
							const Rd = (opCode2 >> 8) & 0xf;
							const sreg = opCode2 & 0xff;
							if (Rd === SP_IDX || Rd === PC_IDX) {
								segFault("SP/PC is not allowed for MRS");
							}
							switch (sreg) {
								case 0: case 1: case 2: case 3:
									// PSR系 APSR (フラグ) を含むもの
									regs[Rd] = (flags << 28) >>> 0;
									break;
								case 5: case 6: case 7:
									// PSR系 APSR (フラグ) を含まないもの
									regs[Rd] = 0;
									break;
								case 8:
									// MSP
									regs[Rd] = control & 2 ? anotherStack : regs[SP_IDX];
									break;
								case 9:
									// PSP
									regs[Rd] = control & 2 ? regs[SP_IDX] : anotherStack;
									break;
								case 16:
									// PRIMASK
									regs[Rd] = primask;
									break;
								case 20:
									// CONTROL
									regs[Rd] = control;
									break;
								default:
									segFault("unknown spec_reg " + sreg + " for MRS");
									break;
							}
						} else if ((opCode & 0xFFF0) === 0xF380 && ((opCode2 >> 8) & 0xf) === 0x8) {
							// spec_reg = Rd
							const Rd = opCode & 0xf;
							const sreg = opCode2 & 0xff;
							if (Rd === SP_IDX || Rd === PC_IDX) {
								segFault("SP/PC is not allowed for MSR");
							}
							switch (sreg) {
								case 0: case 1: case 2: case 3:
									// PSR系 APSR (フラグ) を含むもの
									flags = (regs[Rd] >> 28) & FLAG_ALL;
									break;
								case 5: case 6: case 7:
									// PSR系 APSR (フラグ) を含まないもの
									// 何もしない
									break;
								case 8:
									// MSP
									if (control & 2) {
										anotherStack = regs[Rd];
									} else {
										regs[SP_IDX] = regs[Rd];
									}
									break;
								case 9:
									// PSP
									if (control & 2) {
										regs[SP_IDX] = regs[Rd];
									} else {
										anotherStack = regs[Rd];
									}
									break;
								case 16:
									// PRIMASK
									primask = regs[Rd] & 1;
									break;
								case 20:
									// CONTROL
									{
										const newControl = regs[Rd] & 2;
										if (control ^ newControl) {
											const temp = regs[SP_IDX];
											regs[SP_IDX] = anotherStack;
											anotherStack = temp;
										}
										newControl = control;
									}
									break;
								default:
									segFault("unknown spec_reg " + sreg + " for MSR");
									break;
							}
						}
					} else {
						unknownInstruction(opCode, opCode2);
					}
				}
				break;
			case 0x1F:
				unknownInstruction(opCode);
				break;
		}
		regs[PC_IDX] = nextPC;
	}
}
