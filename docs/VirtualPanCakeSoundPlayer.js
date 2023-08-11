"use strict";

// このファイルは、OneFiveCrowd に対する CC BY 4.0 ライセンス (by みけCAT) の対象外とする。
// This file is NOT subject of CC BY 4.0 license (by MikeCAT) for OneFiveCrowd.

// このファイルは、CC BY-NC 4.0 ライセンスで提供する。(by みけCAT)
// This file is provided under CC BY-NC 4.0 license (by MikeCAT)
// https://creativecommons.org/licenses/by-nc/4.0/deed.ja

// 音色を生成する関数
// pos : 1周期の間の位置 (0: 最初 1: 最後)
const timbres = [
	function(pos) { // 方形波
		return pos < 0.5 ? -1 : 1;
	},
	function(pos) { // 正弦波
		return -Math.cos(pos * Math.PI * 2);
	},
	function(pos) { // 周波数2倍の正弦波に出っ張りがあるやつ
		const base = -Math.cos(pos * Math.PI * 4);
		if (pos < 0.5) {
			return base;
		} else if (pos < 0.75) {
			return base + Math.pow(Math.sin((pos - 0.5) * Math.PI / 0.25), 2) * 0.8;
		} else if (pos < 0.75 + 0.25 / 3) {
			return base - Math.sin((pos - 0.75) * Math.PI / (0.25 * 2 / 3)) * 1.7;
		} else if (pos < 0.75 + 0.25 * 2 / 3) {
			return base + Math.pow(Math.sin((pos - (0.75 * 0.25 / 3)) * Math.PI / (0.25 / 3)), 3);
		} else {
			return base;
		}
	},
	function(pos) { // 頂点が60%の位置の三角波
		return pos < 0.6 ? -1 + 2 * pos / 0.6 : 1 - 2 * (pos - 0.6) / 0.4;
	},
];

// 「ノイズ」のデータ (実機の観察結果に基づく)
const noise_o4 = [8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,10,9,8,9,9,9,9,9,8,8,8,8,8,8,8,8,8,8,9,8,8,8,9,9,9,8,8,8,8,8,9,9,9,9,8,8,9,9,8,8,9,8,8,8,8,8,8,8,9,9,8,9,9,8,8,9,8,8,9,8,8,9,8,9,10,9,8,9,9,9,9,9,9,8,8,9,9,8,9,8,8,8,9,10,10,9,8,8,8,8,9,9,9,9,9,9,8,9,9,9,9,9,9,8,9,8,9,8,9,9,9,9,9,8,9,9,9,9,9,10,9,9,9,10,10,9,9,10,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,8,8,9,9,10,9,9,9,9,9,8,8,9,9,9,9,9,9,8,9,9,10,10,8,8,8,8,8,8,8,8,8,7,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,8,8,8,8,8,8,8,8,7,8,8,7,8,7,8,8,7,8,8,7,7,8,8,8,9,8,8,8,8,8,8,7,7,8,8,7,8,8,8,8,8,8,8,7,8,8,8,8,8,7,8,8,8,8,8,9,8,8,9,9,9,9,9,8,9,8,9,8,8,8,8,8,7,8,8,8,8,8,8,8,9,9,8,8,8,8,7,8,8,8,8,8,8,8,8,7,8,7,7,8,7,7,7,7,7,7,7,8,8,8,7,8,8,7,8,8,8,7,8,8,8,8,8,8,9,8,8,7,7,8,8,7,8,9,8,8,9,8,8,8,9,9,8,9,9,9,8,9,8,9,9,8,9,9,10,8,8,8,8,8,9,9,8,8,9,9,9,8,9,9,9,10,9,8,8,8,9,9,9,8,9,8,8,8,8,8,8,9,8,8,9,8,8,8,8,9,9,9,9,8,8,8,8,8,9,9,9,9,9,9,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,8,8,8,9,9,9,8,9,10,8,9,9,9,9,9,8,8,8,8,8,8,8,7,8,8,8,8,8,8,8,7,7,8,8,7,7,8,8,8,8,8,8,7,7,7,8,7,7,8,8,8,7,8,8,8,7,8,8,8,8,8,8,8,8,8,7,8,8,8,8,8,7,7,8,8,8,8,7,7,7,7,7,7,7,7,7,6,6,8,8,7,8,8,7,8,7,7,8,8,8,7,8,8,8,7,8,7,7,7,8,8,8,8,7,7,8,8,8,7,8,8,8,8,8,7,8,8,8,8,8,8,8,8,8,8,8,7,7,8,8,9,9,9,9,9,9,9,8,8,9,9,9,9,8,8,8,8,8,9,9,9,9,10,10,9,8,9,10,10,10,10,10,9,8,8,8,8,8,8,8,8,8,8,8,7,8,8,8,8,8,8,8,8,7,7,7,7,8,7,8,8,8,8,7,8,8,7,7,8,7,8,8,8,8,8,8,8,7,7,7,7,8,8,7,7,8,8,8,8,8,8,9,8,8,8,9,9,8,8,8,8,7,8,8,8,8,9,9,8,8,8,8,8,7,7,7,7,8,8,8,8,8,8,8,8,8,9,8,9,9,9,9,8,8,8,8,7,7,8,8,7,8,7,7,7,7,7,8,8,8,8,7,8,7,7,7,7,7,7,7,7,8,8,7,8,8,8,7,8,8,8,7,8,8,8,8,8,8,8,8,8,8,9,9,8,9,9,9,8,8,8,8,9,9,9,10,10,9,10,9,8,8,8,8,8,8,8,8,7,7,7,7,8,8,8,8,8,8,9,9,9,9,8,8,8,8,9,9,9,9,8,9,8,9,8,8,8,8,9,9,8,8,8,9,8,8,8,9,9,8,8,8,8,8,8,8,8,8,8,7,8,8,8,8,8,9,9,8,8,8,8,8,8,8,8,8,8,8,8,8,7,7,7,8,8,8,7,7,7,8,7,7,7,7,8,8,8,9,9,8,8,8,7,7,7,7,7,7,8,7,8,8,8,7,8,8,7,8,8,8,8,7,7,8,8,8,7,7,6,7,6,7,8,8,8,8,7,8,8,7,8,8,7,8,8,8,8,7,8,8,7,8,7,8,9,8,8,9,9,9,9,8,8,8,8,8,8,9,9,8,8,9,8,8,8,8,8,8,8,9,9,8,8,8,9,9,9,9,9,9,8,9,8,8,8,8,8,7,7,7,7,8,7,8,8,7,8,8,8,8,8,9,8,8,8,8,8,8,8,8,8,8,9,8,8,8,8,8,8,7,7,8,7,8,8,7,8,7,7,8,8,7,7,8,8,8,9,8,9,8,9,9,8,8,8,8,8,8,8,8,8,7,8,7,7,8,8,8,8,8,8,8,8,7,8,8,8,8,8,8,8,8,8,8,7,8,8,8,8,8,8,9,8,9,9,8,8,8,8,8,7,8,8,8,9,8,8,9,9,9,10,9,9,10,9,8,9,9,8,8,8,8,8,7,8,7,8,9,8,8,9,8,8,8,8,9,9,8,8,8,9,9,8,9,9,9,9,9,9,9,10,9,10,9,9,8,9,10,9,9,9,9,9,9,8,8,8,8,7,8,9,9,9,9,10,9,8,9,10,10,10,10,9,8,8,9,8,9,9,8,9,9,8,9,10,10,10,10,9,10,9,9,10,9,9,10,10,10,10,9,9,9,9,10,9,9,9,9,9,8,8,9,10,10,10,10,9,10,9,9,10,9,8,8,9,10,8,8,8,9,8,8,9,9,9,9,8,8,9,8,8,8,8,8,8,8,8,8,8,8,7,8,8,8,7,8,8,8,8,7,8,8,8,8,9,9,8,9,9,8,8,8,8,8,8,8,9,8,8,8,8,8,9,8,8,8,8,8,7,8,7,8,9,8,8,9,8,8,8,9,8,8,8,8,8,8,9,8,8,8,7,7,8,7,8,8,8,8,7,6,6,6,7,8,7,8,8,8,8,8,8,8,8,7,7,7,6,6,7,8,7,6,6,7,8,8,8,8,8,8,8,8,8,9,8,8,8,8,8,8,9,8,8,8,9,8,8,8,8,8,8,9,8,8,7,8,8,7,7,7,8,8,7,7,8,7,8,7,8,8,8,9,8,8,8,8,9,8,8,8,7,8,8,7,8,8,8,8,8,8,8,7,8,8,8,8,8,8,8,9,8,8,8,9,8,8,8,8,7,7,8,8,8,8,9,8,8,8,8,8,8,7,8,8,8,8,7,7,7,8,8,8,7,7,7,7,7,8,7,8,8,8,8,7,8,8,8,7,7,7,7,7,7,7,8,7,6,6,6,6,6,6,7,7,6,7,7,6,7,8,7,8,7,7,6,6,8,8,8,8,7,8,8,7,8,7,8,8,7,7,7,7,7,7,8,8,7,8,8,8,8,8,8,8,8,7,8,8,8,7,7,8,7,8,7,7,7,8,8,8,8,8,8,7,8,8,8,8,8,8,8,8,8,8,7,7,7,8,7,8,8,8,7,8,7,8,8,8,8,7,8,8,8,8,9,8,8,8,7,8,8,8,8,8,7,8,8,8,7,7];
const noise_o5 = [8,8,8,8,9,9,9,10,8,9,9,8,8,8,8,8,9,8,9,9,8,8,9,9,8,9,8,9,8,8,8,9,8,9,8,8,9,8,8,10,8,9,9,9,8,9,9,8,9,10,8,8,9,9,9,8,9,9,9,9,9,9,9,9,9,9,9,9,9,10,9,8,8,8,8,8,8,8,8,9,8,9,9,9,9,8,9,9,9,9,10,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,7,8,8,8,7,8,7,8,9,8,8,8,7,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,8,8,7,8,8,8,9,8,8,7,8,8,8,8,8,7,7,7,7,7,8,7,8,8,8,8,8,8,9,8,7,8,8,8,9,8,9,8,9,8,8,9,9,10,8,8,9,8,9,9,9,9,9,8,9,9,9,8,8,8,8,9,8,8,9,9,8,8,9,9,9,8,8,8,8,8,9,9,9,8,9,9,9,8,9,9,8,8,8,8,8,8,8,8,7,8,7,8,8,8,7,8,7,8,7,8,7,8,8,8,8,7,8,8,7,8,8,7,7,7,7,7,6,8,8,7,7,8,8,8,8,8,7,8,8,7,8,8,8,8,8,8,8,8,8,8,8,7,8,9,9,9,8,9,9,8,8,8,9,9,10,8,10,10,10,8,8,8,8,8,8,8,8,8,8,7,7,8,8,8,7,8,7,7,8,8,8,7,7,8,7,8,8,8,9,8,9,8,8,7,8,8,9,8,8,7,7,8,8,8,8,8,8,9,9,8,8,7,8,8,7,7,8,8,7,7,7,7,7,8,7,8,7,8,7,8,8,8,8,8,9,9,9,8,8,9,10,9,9,8,8,8,8,7,7,8,8,8,9,9,8,8,9,9,9,9,8,8,9,8,9,8,9,8,8,8,8,8,7,8,8,9,8,8,8,8,8,8,8,7,8,8,7,8,7,7,8,9,8,8,7,7,7,7,8,7,8,8,8,7,8,8,7,7,7,8,8,8,7,8,8,8,7,8,8,8,8,9,9,8,8,8,9,8,9,8,8,8,9,8,8,9,9,9,9,8,8,7,7,8,8,7,8,8,9,8,8,8,8,8,8,8,8,7,8,8,7,7,8,7,8,8,8,8,9,8,8,8,8,7,7,8,8,8,8,7,8,8,8,8,8,8,8,8,9,9,8,8,8,8,8,8,9,9,9,10,8,9,8,8,7,7,9,8,8,8,9,8,8,9,9,9,9,9,9,9,8,10,9,9,9,8,8,8,9,9,9,9,10,10,8,9,9,8,9,9,10,10,10,9,9,10,10,9,9,10,9,9,8,9,10,10,10,9,9,8,10,8,9,8,9,9,8,8,8,8,8,8,8,8,8,8,8,7,8,8,9,9,8,8,8,8,8,8,8,8,8,8,8,8,8,9,8,9,8,8,8,8,8,7,7,8,8,6,6,8,8,8,8,8,7,7,6,8,6,7,8,8,8,8,9,8,8,8,8,8,8,8,8,9,8,8,7,7,8,7,7,7,8,9,8,8,8,8,8,7,8,8,8,7,8,8,8,9,8,9,8,8,7,8,8,8,8,8,7,8,8,7,8,8,7,7,8,8,8,7,8,7,7,7,7,7,6,6,6,7,7,6,8,8,7,6,8,8,8,7,7,8,7,7,7,8,8,8,8,8,7,8,7,8,8,7,8,8,8,7,8,8,8,8,8,7,8,8,8,8,8,8,7,8,8,8,8,8,8,8,8,8,7];
const noise_o6 = [8,8,8,8,8,8,8,8,8,7,8,8,8,8,7,8,8,9,10,9,8,8,8,8,9,8,9,9,9,8,9,9,8,8,10,9,9,9,8,10,8,9,8,9,9,9,9,9,9,10,8,8,8,8,9,9,9,8,9,9,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,8,8,8,8,7,8,8,7,7,7,7,8,8,8,8,8,8,8,8,8,9,10,8,8,9,9,8,9,8,8,9,8,9,8,9,8,8,8,9,8,9,8,9,8,8,8,8,8,8,8,8,8,8,8,8,7,8,8,7,7,7,8,7,8,8,8,8,7,8,8,8,8,8,7,9,9,9,8,8,9,8,10,8,8,8,8,8,7,8,8,8,7,8,7,8,8,8,8,8,7,8,8,7,8,8,8,9,8,7,8,7,8,7,7,8,8,8,8,8,8,9,8,9,9,8,8,7,8,8,9,8,9,9,8,8,8,8,8,8,8,9,8,8,8,7,8,8,7,9,8,7,7,7,8,7,8,7,8,8,8,8,8,8,9,8,8,8,8,8,8,9,9,8,7,8,7,8,8,8,8,8,7,8,7,7,8,8,8,8,7,8,8,7,8,8,8,8,9,8,8,8,9,10,9,8,7,8,8,8,9,9,9,9,10,9,8,8,9,9,10,9,8,9,10,9,10,9,10,9,9,10,9,8,8,8,9,8,8,8,8,8,7,8,9,8,8,8,8,8,8,9,9,8,8,7,8,6,8,8,8,7,8,7,8,8,8,8,8,8,9,8,7,7,7,9,8,8,7,8,7,8,9,9,8,8,8,8,8,7,8,7,8,7,7,7,7,6,7,6,8,6,8,7,8,7,8,8,8,8,8,7,8,7,8,8,7,8,8,8,8,8,8,8,8,8,8,9,9,8,9,8,8,9,9,8,9,8,8,8,8,8,8,9,8,8,9,8,9,9,8,9,9,9,9,9,9,9,9,9,9,8,8,8,8,8,9,9,9,9,10,8,8,8,8,8,8,8,8,7,8,7,7,9,8,7,8,8,8,8,8,8,9,9,8,7,8,9,8,8,8,8,7,7,8,8,8,8,9,7,8,9,9,9,8,9,8,9,9,9,9,9,9,8,8,8,9,8,9,9,8,8,9,9,9,9,9,8,8,8,8,7,7,8,7,7,7,7,8,8,8,7,8,7,7,6,8,7,8,8,7,8,8,8,8,8,8,8,8,9,8,9,8,9,10,10,10,8,8,8,8,8,7,8,7,7,8,8,7,7,8,9,9,8,8,9,8,7,8,8,8,9,8,8,7,8,7,7,7,7,7,7,8,8,9,9,8,10,9,8,8,7,8,9,8,9,9,8,9,9,9,8,8,7,8,8,8,8,8,8,7,7,8,8,7,7,8,8,8,8,7,7,8,7,8,7,8,8,9,8,9,9,8,9,8,9,9,8,7,8,8,9,8,8,8,8,8,7,8,8,8,9,8,8,7,8,8,8,8,8,8,9,8,8,8,9,9,8,8,7,9,8,9,8,9,9,9,8,9,9,8,9,9,10,8,9,9,10,10,9,10,9,9,8,10,10,9,10,9,9,8,8,8,8,8,8,8,9,8,8,8,8,8,8,8,8,8,8,8,7,8,6,8,8,7,6,6,8,8,9,8,8,8,8,8,7,8,7,8,8,8,8,8,8,8,8,8,8,7,8,8,7,8,8,7,8,8,8,7,7,6,6,7,8,7,8,8,7,7,7,8,8,7,7];
const noise_o7 = [8,9,8,9,8,8,8,9,9,9,8,8,8,8,7,8,7,8,8,7,8,8,8,9,9,8,8,9,7,8,8,8,8,8,8,8,7,8,8,8,8,8,9,8,9,9,9,9,9,8,9,8,9,10,10,9,10,9,9,8,8,8,8,8,8,8,8,8,8,8,8,7,6,8,8,8,8,8,8,8,8,8,8,7,8,8,7,8,7,6,7,7,8,7,8,7,8,8,8,8,8,8,8,7,8,10,8,8,9,9,9,9,8,10,9,8,8,8,9,9,9,8,8,9,9,9,8,8,8,8,8,8,8,8,8,8,8,9,8,8,7,8,7,7,8,8,8,8,9,8,9,8,8,9,9,9,8,9,9,9,8,8,8,8,8,8,8,7,7,7,8,8,8,8,8,9,9,8,8,8,8,8,8,8,8,8,8,8,8,7,8,9,7,7,7,8,8,8,9,9,8,7,8,8,9,8,8,8,9,8,7,8,9,7,7,7,7,8,8,8,8,8,8,9,8,8,8,8,8,8,7,8,8,8,7,8,8,8,8,10,8,8,8,9,9,9,8,9,9,9,9,9,9,10,8,8,8,8,8,8,8,8,8,9,8,7,6,8,7,7,8,8,8,8,7,9,8,8,8,9,8,8,7,7,7,7,6,6,6,7,7,8,8,7,7,8,8,8,8,8,8,9,8,8,9,8,8,8,8,9,8,8,9,9,9,9,9,9,8,8,8,9,9,8,8,8,8,7,7,9,7,8,8,8,9,7,9,8,8,7,8,8,7,9,9,9,9,9,9,8,8,8,9,8,9,9,8,8,7,8,7,7,8,7,7,6,7,8,8,8,8,8,9,9,9,10,8,8,8,8,7,8,7,9,8,9,7,8,9,8,8,7,7,7,8,9,10,8,7,9,9,8,9,8,7,8,8,8,7,8,7,8,8,7,7,7,8,8,9,9,9,8,8,9,8,8,7,8,9,8,8,8,8,9,8,9,8,7,8,8,9,8,9,9,10,9,10,9,9,8,10,10,9,8,8,8,9,8,8,8,8,8,7,6,8,6,8,9,8,8,7,7,8,8,8,8,8,8,7,8,8,8,7,6,8,8,7,7,8,7,8,8,8,8,7,8,8,8,9,9,8,8,8,9,8,9,8,9,9,10,9,9,9,9,10,8,8,9,8,9,8,8,8,8,8,8,8,8,8,8,9,9,8,8,8,7,7,8,8,8,8,8,10,8,9,9,8,8,8,8,8,8,8,8,8,8,8,8,8,7,8,7,8,8,8,7,8,8,7,9,8,9,10,8,8,7,8,7,7,8,8,7,8,8,8,8,8,8,7,8,8,8,8,9,8,8,9,9,8,8,8,8,8,8,8,7,8,7,8,8,8,8,8,9,8,8,8,9,7,7,8,8,7,7,8,8,7,8,8,8,9,8,9,9,7,8,9,9,10,8,9,10,8,10,10,10,9,9,8,9,8,8,7,9,8,8,8,9,8,8,8,8,8,8,8,8,9,7,7,8,7,7,9,8,8,8,8,8,7,7,7,8,8,8,8,8,8,8,8,7,8,8,8,8,8,9,9,8,9,9,8,8,8,8,9,9,8,9,9,9,9,9,8,8,9,9,10,8,8,8,8,8,7,8,8,8,8,9,8,8,8,8,7,8,8,9,8,9,8,8,9,9,9,8,9,9,8,9,9,9,8,8,7,7,7,8,8,8,7,8,8,7,8,8,8,8,8,8,10,10,8,8,7,7,8,7,8,9,8,8,8,8,8,7,7,7,7];

const noiseFunctionGenerator = function(puttern, period_ms) {
	const framePerPeriod = Math.round(sampleRate * period_ms / 1000);
	return function(frame) {
		const pos = (frame % framePerPeriod) / framePerPeriod;
		return (puttern[~~(pos * puttern.length)] - 8) / 3;
	};
};

const O5_NOISE_PERIOD_MS = 49.927;

const noiseFunctions = [
	noiseFunctionGenerator(noise_o4, O5_NOISE_PERIOD_MS * 32),
	noiseFunctionGenerator(noise_o4, O5_NOISE_PERIOD_MS * 16),
	noiseFunctionGenerator(noise_o4, O5_NOISE_PERIOD_MS * 8),
	noiseFunctionGenerator(noise_o4, O5_NOISE_PERIOD_MS * 4),
	noiseFunctionGenerator(noise_o4, O5_NOISE_PERIOD_MS * 2),
	noiseFunctionGenerator(noise_o5, O5_NOISE_PERIOD_MS),
	noiseFunctionGenerator(noise_o6, O5_NOISE_PERIOD_MS),
	noiseFunctionGenerator(noise_o7, O5_NOISE_PERIOD_MS),
];

const DURATION_MS_PER_TEMPO = 32;

const OCTAVE_ORIGIN = 4;
const OCTAVE_ORIGIN_FREQ_HZ = 440;

const createChannelInfo = function() {
	return {
		"timbre": 0,
		"startFrame": 0,
		"sound": 0x0f,
		"mml": [],
		"mmlTimbre": 0,
		"mmlStartFrame": 0,
		"mmlFramePerElement": 1,
		"mmlCurrentElement": 0,
		"mmlRepeatElement": 0,
	};
};

class VirtualPanCakeSoundPlayer extends AudioWorkletProcessor {
	constructor(...args) {
		super(...args);
		const thisObj = this;
		thisObj.channels = [
			createChannelInfo(),
			createChannelInfo(),
			createChannelInfo(),
			createChannelInfo(),
		];
		thisObj.port.onmessage = function(event) {
			const data = event.data;
			if (data.type === "sound") {
				for (let i = 0; i < thisObj.channels.length && data.channels.length; i++) {
					thisObj.channels[i].timbre = data.channels[i].timbre;
					thisObj.channels[i].startFrame = currentFrame;
					thisObj.channels[i].sound = data.channels[i].sound;
				}
			} else if (data.type === "sound1") {
				if (0 <= data.channel && data.channel < thisObj.channels.length) {
					thisObj.channels[data.channel].timbre = data.timbre;
					thisObj.channels[data.channel].startFrame = currentFrame;
					thisObj.channels[data.channel].sound = data.sound;
				}
			} else if (data.type === "score") {
				if (0 <= data.channel && data.channel < thisObj.channels.length) {
					thisObj.channels[data.channel].mml = data.mml.concat();
					thisObj.channels[data.channel].mmlTimbre = data.timbre;
					thisObj.channels[data.channel].mmlFramePerElement = Math.round(sampleRate * DURATION_MS_PER_TEMPO * (data.tempo + 1) / 1000);
					if (data.playNow) {
						thisObj.channels[data.channel].mmlStartFrame = currentFrame - thisObj.channels[data.channel].mmlFramePerElement;
						thisObj.channels[data.channel].mmlCurrentElement = -1;
					} else {
						thisObj.channels[data.channel].mmlStartFrame = currentFrame;
						thisObj.channels[data.channel].mmlCurrentElement = thisObj.channels[data.channel].mml.length;
					}
					thisObj.channels[data.channel].mmlRepeatElement = thisObj.channels[data.channel].mml.length;
					for (let i = thisObj.channels[data.channel].mml.length - 1; i >= 0; i--) {
						if (thisObj.channels[data.channel].mml[i] === 0xfe) {
							thisObj.channels[data.channel].mmlRepeatElement = i + 1;
							break;
						}
					}
				}
			} else if (data.type === "play") {
				for (let i = 0; i < thisObj.channels.length; i++) {
					if (!("channel" in data) || data.channel < 0 || data.channel === i) {
						if (data.play) {
							thisObj.channels[i].mmlStartFrame = currentFrame - thisObj.channels[i].mmlFramePerElement;
							thisObj.channels[i].mmlCurrentElement = -1;
						} else {
							thisObj.channels[i].sound = 0x0f;
							thisObj.channels[i].mmlCurrentElement = thisObj.channels[i].mml.length;
						}
					}
				}
			} else if (data.type === "reset") {
				for (let i = 0; i < thisObj.channels.length; i++) {
					thisObj.channels[i] = createChannelInfo();
				}
			}
		};
	}

	process(inputs, outputs, parameters) {
		const output = outputs[0][0];
		for (let i = 0; i < output.length; i++) {
			const frameNo = currentFrame + i;
			let frameResult = 0;
			this.channels.forEach(function(channel) {
				// MMLの処理を行う
				if (channel.mmlCurrentElement < channel.mml.length) {
					if (frameNo >= channel.mmlStartFrame + channel.mmlFramePerElement) {
						channel.mmlCurrentElement++;
						// 繰り返しを表すデータを飛ばす
						while (channel.mmlCurrentElement < channel.mml.length && channel.mml[channel.mmlCurrentElement] === 0xfe) {
							channel.mmlCurrentElement++;
						}
						// データ終端、または終了を表すデータで終了または繰り返し
						if (channel.mmlCurrentElement >= channel.mml.length || channel.mml[channel.mmlCurrentElement] === 0xff) {
							if (channel.mmlRepeatElement < channel.mmlCurrentElement) {
								// 繰り返し
								channel.mmlCurrentElement = channel.mmlRepeatElement;
							} else {
								// MMLの終了
								channel.sound = 0x0f;
							}
						}
						// 次のデータを実行する
						if (channel.mmlCurrentElement < channel.mml.length) {
							if (channel.mml[channel.mmlCurrentElement] < 0xfd) {
								// 「伸ばす」以外 → MMLに基づいて鳴らす音を設定する
								channel.timbre = channel.mmlTimbre;
								channel.startFrame = frameNo;
								channel.sound = channel.mml[channel.mmlCurrentElement];
							}
						}
						channel.mmlStartFrame = frameNo;
					}
				}
				// 設定されている音を鳴らす
				const octave = (channel.sound >> 4) & 0x7;
				const kind = channel.sound & 0xf;
				if (kind === 0xe) {
					// 「ノイズ」
					frameResult += noiseFunctions[octave](frameNo - channel.startFrame);
				} else if (kind < 0xc) {
					// 音符
					const freq_hz = OCTAVE_ORIGIN_FREQ_HZ * Math.pow(2, octave - OCTAVE_ORIGIN + (kind - 9) / 12);
					const frame_per_period = Math.round(sampleRate / freq_hz);
					frameResult += timbres[channel.timbre](((frameNo - channel.startFrame) % frame_per_period) / frame_per_period);
				}
			});
			// スケールとクランプを行う
			frameResult *= 0.5;
			if (frameResult < -1) frameResult = -1;
			if (frameResult > 1) frameResult = 1;
			output[i] = frameResult;
		}
		for (let i = 1; i < outputs[0].length; i++) {
			for (let j = 0; j < outputs[0][0].length; j++) {
				outputs[0][i][j] = outputs[0][0][j];
			}
		}
		return true;
	}
}

registerProcessor("VirtualPanCakeSoundPlayer", VirtualPanCakeSoundPlayer);
