I/O Board for OneFiveCrowd
==========================

MCP2221とI/Oエキスパンダを用い、USB経由でのI/Oを実現します。

ハードウェアの制約により、以下の制約があります。

* 5Vトレラントではありません。
* PWMは非対応です。
* BTN・IN2・IN3以外のADCは非対応です。
* IN2・IN3のプルアップは非対応です。
* DACでは1種類の値しか出力できません。

[IchigoJam T ガーバーデータ](https://ichigojam.net/download.html) ([CC BY](https://creativecommons.org/licenses/by/4.0/deed.ja) [aitendo](http://www.aitendo.com/) & [jig.jp](http://jig.jp/)) を参照し、互換性のある端子および穴の配置としています。

さらに、I2C用のGROVEコネクタおよび Digilent Pmod™ Interface Specification を参考にしたコネクタも用意しています。

## リソース

* [回路図](io_board_v1_0.pdf)
* [ガーバーファイル](io_board-gerver_v1_0.zip)

## パーツリスト

|リファレンス|種類|値|
|---|---|---|
|U1|IC|USBブリッジ MCP2221A-I/SL (SOIC 1.27mmピッチ)|
|U2|IC|I/Oエキスパンダ MCP23008-E/SO (SOIC 1.27mmピッチ)|
|U3|IC|3端子レギュレータ 3.3V NJM2845DL1-33|
|R1、R2|抵抗|5.1kΩ 1/4Wサイズ (長さ6.3mm)|
|R3|抵抗|1MΩ 1/4Wサイズ (長さ6.3mm)|
|R4|抵抗|LED用 (抵抗値はお好みで) 1/4Wサイズ (長さ6.3mm)|
|R5、R6|抵抗|10kΩ 1/4Wサイズ (長さ6.3mm)|
|C1|コンデンサ|0.33μF 5mmピッチ|
|C2|コンデンサ|2.2μF 5mmピッチ|
|C3、C4|コンデンサ|0.1μF 2.54mmピッチ|
|D1|LED|お好みで (砲弾型Φ5mm推奨)|
|SW1|スイッチ|タクトスイッチ 6mm DTS-6 (TS-0606) シリーズ|
|SW2|スイッチ|スライドスイッチ 2.54mmピッチ 1回路2接点 (SS-12D00G3 など)|
|J1|USBコネクタ|秋月 K-15426 / K-13080|
|J2、J3|ピンソケット|2.54mmピッチ 1×14|
|J4|ピンソケット|2.54mmピッチ 1×5|
|J5|ピンソケット|2.54mmピッチ L型 1×6|
|J6|コネクタ|GROVE 4ピンコネクタ 垂直タイプ|
