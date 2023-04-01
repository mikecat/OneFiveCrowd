"use strict";

// Edwards-Curve Digital Signature Algorithm (EdDSA)
// https://www.rfc-editor.org/rfc/rfc8032

const ed25519 = (function() {
	const p = (1n << 255n) - 19n;
	const c = 3n;
	const n = 254n;
	const d = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
	const L = (1n << 252n) + 27742317777372353535851937790883648493n;

	// data: ArrayBuffer or a view of ArrayBuffer
	// returns DataView
	const getDataView = function(data) {
		if (ArrayBuffer.isView(data)) {
			return new DataView(data.buffer, data.byteOffset, data.byteLength);
		} else if (data instanceof ArrayBuffer) {
			return new DataView(data);
		} else {
			throw "invalid data";
		}
	}

	// a: BigInt, n: BigInt
	// returns BigInt
	const bigIntPow = function(a, n) {
		let ans = 1n;
		while (n > 0n) {
			if ((n & 1n) !== 0n) ans = ans * a % p;
			if (n > 1n) a = a * a % p;
			n >>= 1n;
		}
		return ans;
	};

	// data: ArrayBuffer or a view of ArrayBuffer
	// returns BigInt
	const bytesToBigInt = function(data) {
		const dView = getDataView(data);
		let result = 0n;
		for (let i = dView.byteLength - 1; i >= 0; i--) {
			result = (result << 8n) | BigInt(dView.getUint8(i));
		}
		return result;
	}

	const CurvePoint = (function() {
		const CurvePoint = function(){
			this.x = 0n;
			this.y = 1n;
			this.z = 1n;
			this.t = 0n;
		};

		// x: BigInt, y: BigInt
		// returns CurvePoint
		CurvePoint.fromXY = function(x, y) {
			const res = new CurvePoint();
			res.x = x;
			res.y = y;
			res.z = 1n;
			res.t = (x * y) % p;
			return res;
		};

		// data: ArrayBuffer or a view of ArrayBuffer
		// returns CurvePoint
		CurvePoint.fromBytes = function(data) {
			const dView = getDataView(data);
			let y = 0n;
			if (dView.byteLength !== 32) return null;
			for (let i = 0; i < 8; i++) {
				y = (y << 32n) | BigInt(dView.getUint32(4 * (7 - i), true));
				if (i === 0) y &= 0x7fffffffn;
			}
			if (y >= p) return null;
			const u = (y * y - 1n + p) % p;
			const v = (d * y * y + 1n) % p;
			const x1 = u * bigIntPow(v, 3n) * bigIntPow(u * bigIntPow(v, 7n) % p, (p - 5n) / 8n) % p;
			const check = v * x1 * x1 % p;
			let x = null;
			if (check === u) x = x1;
			else if (check === p - u) x = x1 * bigIntPow(2n, (p - 1n) / 4n) % p;
			else return null;
			const lsbOfXIsOne = (dView.getUint8(31) & 0x80) !== 0;
			if (lsbOfXIsOne && x === 0n) return 0;
			if (lsbOfXIsOne !== ((x & 1n) !== 0n)) {
				return CurvePoint.fromXY(p - x, y);
			} else {
				return CurvePoint.fromXY(x, y);
			}
		};

		// cp: CurvePoint
		// returns CurvePoint
		CurvePoint.prototype.add = function(cp) {
			const x1 = this.x, y1 = this.y, z1 = this.z, t1 = this.t;
			const x2 = cp.x, y2 = cp.y, z2 = cp.z, t2 = cp.t;
			const A = (y1 - x1) * (y2 - x2);
			const B = (y1 + x1) * (y2 + x2);
			const C = t1 * 2n * d * t2;
			const D = z1 * 2n * z2;
			const E = B - A;
			const F = D - C;
			const G = D + C;
			const H = B + A;
			const x3 = E * F % p;
			const y3 = G * H % p;
			const t3 = E * H % p;
			const z3 = F * G % p;
			const res = new CurvePoint();
			res.x = x3 < 0n ? x3 + p : x3;
			res.y = y3 < 0n ? y3 + p : y3;
			res.t = t3 < 0n ? t3 + p : t3;
			res.z = z3 < 0n ? z3 + p : z3;
			return res;
		};

		// returns CurvePoint
		CurvePoint.prototype.addSelf = function() {
			const x1 = this.x, y1 = this.y, z1 = this.z, t1 = this.t;
			const A = x1 * x1;
			const B = y1 * y1;
			const C = 2n * z1 * z1;
			const H = A + B;
			const E = H - (x1 + y1) * (x1 + y1);
			const G = A - B;
			const F = C + G;
			const x3 = E * F % p;
			const y3 = G * H % p;
			const t3 = E * H % p;
			const z3 = F * G % p;
			const res = new CurvePoint();
			res.x = x3 < 0n ? x3 + p : x3;
			res.y = y3 < 0n ? y3 + p : y3;
			res.t = t3 < 0n ? t3 + p : t3;
			res.z = z3 < 0n ? z3 + p : z3;
			return res;
		};

		// n: BigInt
		// returns CurvePoint
		CurvePoint.prototype.addSelfNTimes = function(n) {
			let current = this;
			let res = CurvePoint.fromXY(0n, 1n);
			while (n > 0n) {
				if ((n & 1n) !== 0n) res = res.add(current);
				if (n > 1n) current = current.add(current); //current = current.addSelf();
				n >>= 1n;
			}
			return res;
		};

		// returns ArrayBuffer
		CurvePoint.prototype.toBytes = function() {
			const zInv = bigIntPow(this.z, p - 2n);
			const x = this.x * zInv % p, y = this.y * zInv % p;
			const d = new DataView(new ArrayBuffer(32));
			for (let i = 0, t = y; i < 8; i++) {
				d.setUint32(4 * i, Number(t & 0xffffffffn), true);
				t >>= 32n;
			}
			if ((x & 1n) !== 0n) {
				d.setUint8(31, d.getUint8(31) | 0x80);
			}
			return d.buffer;
		};

		return CurvePoint;
	})();

	const B = CurvePoint.fromXY(
		15112221349535400772501151409588531511454012693041857206046113283949847762202n,
		46316835694926478169428394003475163141307993866256225615783033603165251855960n
	);

	// privateKey: ArrayBuffer or a view of ArrayBuffer
	// returns Object
	const getPublicKeyInternal = async function(privateKey) {
		const hk = await crypto.subtle.digest("SHA-512", privateKey);
		const s = (1n << n) + (bytesToBigInt(hk) & (((1n << (n - c)) - 1n) << c));
		const A = B.addSelfNTimes(s);
		return {
			"hkUpper": new Uint8Array(hk, 32, 32),
			"s": s,
			"A": A.toBytes(),
		};
	};

	// privateKey: ArrayBuffer or a view of ArrayBuffer
	// returns ArrayBuffer
	const getPublicKey = async function(privateKey) {
		return (await getPublicKeyInternal(privateKey)).A;
	};

	// M: ArrayBuffer or a view of ArrayBuffer (message)
	// k: ArrayBuffer or a view of ArrayBuffer (private key)
	// returns ArrayBuffer
	const sign = async function(M, k) {
		const pk = await getPublicKeyInternal(k);
		const mView = getDataView(M);
		const rData = new Uint8Array(32 + mView.byteLength);
		for (let i = 0; i < 32; i++) {
			rData[i] = pk.hkUpper[i];
		}
		for (let i = 0; i < mView.byteLength; i++) {
			rData[32 + i] = mView.getUint8(i);
		}
		const r = bytesToBigInt(await crypto.subtle.digest("SHA-512", rData));
		const R = B.addSelfNTimes(r);
		const rBytes = new Uint8Array(R.toBytes());
		const aBytes = new Uint8Array(pk.A);
		const sHashData = new Uint8Array(rBytes.length + aBytes.length + mView.byteLength);
		for (let i = 0; i < rBytes.length; i++) {
			sHashData[i] = rBytes[i];
		}
		for (let i = 0; i < aBytes.length; i++) {
			sHashData[rBytes.length + i] = aBytes[i];
		}
		for (let i = 0; i < mView.byteLength; i++) {
			sHashData[rBytes.length + aBytes.length + i] = mView.getUint8(i);
		}
		const sTemp = bytesToBigInt(await crypto.subtle.digest("SHA-512", sHashData));
		const S = (r + sTemp * pk.s) % L;
		const result = new Uint8Array(rBytes.length + 32);
		for (let i = 0; i < rBytes.length; i++) {
			result[i] = rBytes[i];
		}
		for (let i = 0; i < 32; i++) {
			result[rBytes.length + i] = Number((S >> BigInt(8 * i)) & 0xffn);
		}
		return result.buffer;
	};

	// M: ArrayBuffer or a view of ArrayBuffer (message)
	// publicKey: ArrayBuffer or a view of ArrayBuffer
	// signature: ArrayBuffer or a view of ArrayBuffer
	// returns boolean (true: success / false: failed)
	const verify = async function(M, publicKey, signature) {
		const sigView = getDataView(signature), pkView = getDataView(publicKey);
		if (sigView.byteLength !== 64 || pkView.byteLength !== 32) return false;
		const A = CurvePoint.fromBytes(pkView);
		const R = CurvePoint.fromBytes(new Uint8Array(sigView.buffer, sigView.byteOffset, 32));
		if (A === null || R === null) return false;
		const S = bytesToBigInt(new Uint8Array(sigView.buffer, sigView.byteOffset + 32, 32));
		if (S >= L) return false;
		const mView = getDataView(M);
		const hData = new Uint8Array(64 + mView.byteLength);
		for (let i = 0; i < 32; i++) {
			hData[i] = sigView.getUint8(i);
			hData[32 + i] = pkView.getUint8(i);
		}
		for (let i = 0; i < mView.byteLength; i++) {
			hData[64 + i] = mView.getUint8(i);
		}
		const h = bytesToBigInt(await crypto.subtle.digest("SHA-512", hData));
		const left = B.addSelfNTimes((1n << c) * S);
		const right = R.addSelfNTimes(1n << c).add(A.addSelfNTimes((1n << c) * h));
		const leftBytes = left.toBytes(), rightBytes = right.toBytes();
		if (leftBytes.byteLength !== rightBytes.byteLength) return false;
		const leftUint8 = new Uint8Array(leftBytes), rightUint8 = new Uint8Array(rightBytes);
		for (let i = 0; i < leftUint8.length; i++) {
			if (leftUint8[i] !== rightUint8[i]) return false;
		}
		return true;
	}

	return {
		"getPublicKey": getPublicKey,
		"sign": sign,
		"verify": verify,
	};
})();
