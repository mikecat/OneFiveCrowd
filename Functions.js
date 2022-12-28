"use strict";

function functionTICK(args) {
	// 時刻を取得する
	const isHiRes = args.length > 0 && args[0] !== 0;
	const tick = (performance.now() - tickOrigin) / 1000 * TICK_PER_SECOND * (isHiRes ? TICK_HIRES_MULT : 1);
	return Math.floor(tick) % 32768;
}

function functionPEEK(args) {
	// 仮想メモリからデータを読み込む
	return readVirtualMem(args[0]);
}

function functionRND(args) {
	// 0以上第一引数未満の乱数を返す
	const max = args[0];
	if (max <= 0) return 0;
	return (Math.random() * max) >>> 0;
}
