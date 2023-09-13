"use strict";

const virtualEepromManager = (function() {
	const elements = {};
	const temporalEeproms = {};
	let nextTemporalEepromId = 1;
	let db = null;

	const VALID_ID_MIN = 100;
	const VALID_ID_MAX = 227;
	const ID_MULT_FOR_KEY = 1000;

	const EEPROM_LIST = "EEPROM-list";
	const EEPROM_DATA = "EEPROM-data";

	const TEMPORAL_PREFIX = "t";
	const SAVED_PREFIX = "d";

	const emptyData = new Uint8Array(PRG_MAX_CAKE);
	for (let i = 0; i < emptyData.length; i++) {
		emptyData[i] = 0xff;
	}

	function requestAsPromise(request) {
		return new Promise(function(resolve, reject) {
			if (!request) reject();
			request.onerror = function() {
				reject(request.error);
			};
			request.onsuccess = function() {
				resolve(request.result);
			};
		});
	}

	async function eepromSelectUpdateOptions(newValueToSelect) {
		const valueToSelect = typeof newValueToSelect === "undefined" ? elements.virtualEepromSelect.value : newValueToSelect;
		const temporalList = [], savedList = [];
		// メモリ上のEEPROMのリストを取得する
		Object.keys(temporalEeproms).forEach(function(key) {
			temporalList.push({
				"id": key,
				"name": temporalEeproms[key].name
			});
		});
		// DB上のEEPROMのリストを取得する
		if (db) {
			try {
				const tr = db.transaction(EEPROM_LIST, "readonly");
				const os = tr.objectStore(EEPROM_LIST);
				await new Promise(function(resolve, reject) {
					const req = os.openCursor();
					req.onerror = function() {
						reject(req.error);
					};
					req.onsuccess = function(event) {
						const cursor = event.target.result;
						if (cursor) {
							savedList.push({
								"id": cursor.key,
								"name": cursor.value && cursor.value.name,
							});
							cursor.continue();
						} else {
							resolve();
						}
					};
				});
			} catch (e) {
				console.warn(e);
			}
		}
		// selectの子供を全消しする
		while (elements.virtualEepromSelect.firstChild) {
			elements.virtualEepromSelect.removeChild(elements.virtualEepromSelect.firstChild);
		}
		if (temporalList.length === 0 && savedList.length === 0) {
			// EEPROMが1件も無いため、接続と選択UIを無効化する
			const option = document.createElement("option");
			option.setAttribute("value","");
			option.setAttribute("data-t9n-en","(No virtual EEPROM)");
			option.appendChild(document.createTextNode("(仮想EEPROMがありません)"));
			elements.virtualEepromSelect.appendChild(option);
			elements.virtualEepromSelect.selectedIndex = 0;
			elements.virtualEepromSelect.disabled = true;
			elements.virtualEepromConnectCheckbox.checked = false;
			elements.virtualEepromConnectCheckbox.disabled = true;
		} else {
			// 接続と選択をできるようにする
			elements.virtualEepromConnectCheckbox.disabled = false;
			elements.virtualEepromSelect.disabled = false;
			// 取得したリストを選択UIに反映する
			if (temporalList.length > 0) {
				const group = document.createElement("optgroup");
				group.setAttribute("label", "一時参照中 (未保存)");
				group.setAttribute("data-t9n-en-label", "Temporary referencing (not saved)");
				elements.virtualEepromSelect.appendChild(group);
				temporalList.forEach(function(data) {
					const option = document.createElement("option");
					option.setAttribute("value", TEMPORAL_PREFIX + data.id);
					option.appendChild(document.createTextNode(data.name));
					group.appendChild(option);
				});
			}
			if (savedList.length > 0) {
				const group = document.createElement("optgroup");
				group.setAttribute("label", "ブラウザに保存済み");
				group.setAttribute("data-t9n-en-label", "Saved on your browser");
				elements.virtualEepromSelect.appendChild(group);
				savedList.forEach(function(data) {
					const option = document.createElement("option");
					option.setAttribute("value", SAVED_PREFIX + data.id);
					option.appendChild(document.createTextNode(data.name));
					group.appendChild(option);
				});
			}
			const options = elements.virtualEepromSelect.options;
			let match = -1, firstTemporal = -1, firstSaved = -1;
			for (let i = 0; i < options.length; i++) {
				const value = options[i].value;
				if (value === valueToSelect) {
					match = i;
				}
				if (firstTemporal < 0 && value.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
					firstTemporal = i;
				}
				if (firstSaved < 0 && value.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
					firstSaved = i;
				}
			}
			// 指定のIDがあれば、それを選択する
			// 指定のIDが無い場合 (削除時など)、指定のIDと同じ種類を優先して選択する
			if (match >= 0) {
				elements.virtualEepromSelect.selectedIndex = match;
			} else if (firstTemporal >= 0 && valueToSelect.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
				elements.virtualEepromSelect.selectedIndex = firstTemporal;
			} else if (firstSaved >= 0) {
				elements.virtualEepromSelect.selectedIndex = firstSaved;
			} else {
				elements.virtualEepromSelect.selectedIndex = 0;
			}
		}
		updateDisplayLanguage(elements.virtualEepromSelect);
		eepromSelectChangeHandler();
	}

	function eepromSelectChangeHandler() {
		const value = elements.virtualEepromSelect.value;
		const isValid = value !== "";
		const isTemporal = value.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX;
		elements.virtualEepromSaveButton.disabled = db === null || !isTemporal;
		elements.virtualEepromRenameButton.disabled = !isValid;
		elements.virtualEepromExportButton.disabled = !isValid;
		elements.virtualEepromDeleteButton.disabled = !isValid;
		if (isTemporal) {
			elements.virtualEepromTemporalIndicator.classList.add("temporal");
		} else {
			elements.virtualEepromTemporalIndicator.classList.remove("temporal");
		}
		if (value.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
			writeLocalStorage("virtualEepromSelected", value);
		}
	}

	async function createVirtualEEPROM() {
		if (!db) return;
		try {
			const tr = db.transaction(EEPROM_LIST, "readwrite");
			const os = tr.objectStore(EEPROM_LIST);
			const key = await requestAsPromise(os.add({}));
			if ((key + 1) * ID_MULT_FOR_KEY >= Number.MAX_SAFE_INTEGER) {
				// キーが大きすぎるため、安全にデータを保存できない
				tr.abort();
			} else {
				await requestAsPromise(os.put({
					"name": "EEPROM " + key,
				}, key));
				await eepromSelectUpdateOptions(SAVED_PREFIX + key);
			}
			// 新規作成時自動で接続する (参照したい可能性が大きいと考えられるので)
			elements.virtualEepromConnectCheckbox.checked = true;
		} catch (e) {
			console.warn(e);
		}
	}

	async function importVirtualEEPROM() {
		const file = elements.virtualEepromFileSelector.files[0];
		elements.virtualEepromFileSelector.value = "";
		if (!file) return;
		try {
			const fileData = JSON.parse(await file.text());
			const dataToImport = {};
			if ("name" in fileData) {
				dataToImport.name = fileData.name;
			} else {
				dataToImport.name = file.name.replace(/\..*$/, "");
			}
			dataToImport.data = {};
			for (let i = VALID_ID_MIN; i <= VALID_ID_MAX; i++) {
				if (i in fileData.data) {
					try {
						const data = atob(fileData.data[i]);
						const dataArray = new Uint8Array(data.length);
						for (let j = 0; j < data.length; j++) {
							dataArray[j] = data.charCodeAt(j);
						}
						dataToImport.data[i] = dataArray;
					} catch (e) {
						console.warn(e);
					}
				}
			}
			const key = nextTemporalEepromId++;
			temporalEeproms[key] = dataToImport;
			await eepromSelectUpdateOptions(TEMPORAL_PREFIX + key);
			// インポート時自動で接続する (参照したい可能性が大きいと考えられるので)
			elements.virtualEepromConnectCheckbox.checked = true;
		} catch (e) {
			console.warn(e);
			alert(elements.virtualEepromImportFailureMessage.textContent);
		}
	}

	async function saveVirtualEEPROM() {
		if (!db) return;
		const id = elements.virtualEepromSelect.value;
		if (id.substring(0, TEMPORAL_PREFIX.length) !== TEMPORAL_PREFIX) return;
		const id2 = parseInt(id.substring(TEMPORAL_PREFIX.length));
		if (isNaN(id2)) return;
		if (!(id2 in temporalEeproms)) return;
		const target = temporalEeproms[id2];
		try {
			const tr = db.transaction([EEPROM_LIST, EEPROM_DATA], "readwrite");
			const os = tr.objectStore(EEPROM_LIST);
			const key = await requestAsPromise(os.add({
				"name": target.name,
			}));
			if ((key + 1) * ID_MULT_FOR_KEY >= Number.MAX_SAFE_INTEGER) {
				// キーが大きすぎるため、安全にデータを保存できない
				tr.abort();
				return;
			}
			const osData = tr.objectStore(EEPROM_DATA);
			for (let i = VALID_ID_MIN; i <= VALID_ID_MAX; i++) {
				if (i in target.data) {
					await requestAsPromise(osData.add(target.data[i], key * ID_MULT_FOR_KEY + i));
				}
			}
			delete temporalEeproms[id2];
			await eepromSelectUpdateOptions(SAVED_PREFIX + key);
		} catch (e) {
			console.warn(e);
		}
	}

	async function renameVirtualEEPROM() {
		const id = elements.virtualEepromSelect.value;
		if (id.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
			// メモリ上のEEPROMが対象
			const id2 = parseInt(id.substring(TEMPORAL_PREFIX.length));
			if (isNaN(id2)) return;
			if (!(id2 in temporalEeproms)) return;
			const target = temporalEeproms[id2];
			const newName = prompt(elements.virtualEepromRenamePromptMessage.textContent, target.name);
			if (newName !== null) target.name = newName;
		} else if (db && id.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
			// DB上のEEPROMが対象
			const id2 = parseInt(id.substring(SAVED_PREFIX.length));
			if (isNaN(id2)) return;
			try {
				const tr = db.transaction(EEPROM_LIST, "readwrite");
				const os = tr.objectStore(EEPROM_LIST);
				const cursor = await requestAsPromise(os.openCursor(id2));
				if (cursor !== null) {
					const value = cursor.value;
					const newName = prompt(elements.virtualEepromRenamePromptMessage.textContent, value.name);
					if (newName !== null) {
						value.name = newName;
						await requestAsPromise(cursor.update(value));
					}
				}
			} catch (e) {
				console.warn(e);
			}
		}
		await eepromSelectUpdateOptions();
	}

	async function getCurrentEepromData() {
		const id = elements.virtualEepromSelect.value;
		let dataToExport = null;
		if (id.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
			// メモリ上のEEPROMが対象
			const id2 = parseInt(id.substring(TEMPORAL_PREFIX.length));
			if (isNaN(id2)) return null;
			if (!(id2 in temporalEeproms)) return null;
			dataToExport = temporalEeproms[id2];
		} else if (db && id.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
			// DB上のEEPROMが対象
			const id2 = parseInt(id.substring(SAVED_PREFIX.length));
			if (isNaN(id2)) return null;
			try {
				const tr = db.transaction([EEPROM_LIST, EEPROM_DATA], "readonly");
				const os = tr.objectStore(EEPROM_LIST);
				const cursor = await requestAsPromise(os.openCursor(id2));
				if (cursor !== null) {
					const eepromId = cursor.key;
					const value = cursor.value;
					const loadedObject = {"name": value.name, "data": {}};
					const osData = tr.objectStore(EEPROM_DATA);
					await new Promise(function(resolve, reject) {
						const req = osData.openCursor(IDBKeyRange.bound(
							eepromId * ID_MULT_FOR_KEY, (eepromId + 1) * ID_MULT_FOR_KEY, false, true
						));
						req.onerror = function() {
							reject(req.error);
						};
						req.onsuccess = function(event) {
							const dataCursor = event.target.result;
							if (dataCursor) {
								loadedObject.data[dataCursor.key % ID_MULT_FOR_KEY] = dataCursor.value;
								dataCursor.continue();
							} else {
								resolve();
							}
						};
					});
					dataToExport = loadedObject;
				}
			} catch (e) {
				console.warn(e);
			}
		}
		if (dataToExport === null) return null;
		const exportedObject = {};
		if ("name" in dataToExport) exportedObject.name = dataToExport.name.toString();
		exportedObject.data = {};
		if (dataToExport.data) {
			for (let i = VALID_ID_MIN; i <= VALID_ID_MAX; i++) {
				if (i in dataToExport.data) {
					const data = dataToExport.data[i];
					if (data instanceof Uint8Array) {
						let dataString = "";
						for (let j = 0; j < data.length; j++) {
							dataString += String.fromCharCode(data[j]);
						}
						exportedObject.data[i] = btoa(dataString.replace(/\0+$/, ""));
					}
				}
			}
		}
		return exportedObject;
	}

	let previousExportedURL = null;
	async function exportVirtualEEPROM() {
		const exportedObject = await getCurrentEepromData();
		if (!exportedObject) return;
		const exportedJson = JSON.stringify(exportedObject);
		const exportedBlob = new Blob([exportedJson], {"type": "application/json"});
		const exportedURL = URL.createObjectURL(exportedBlob);
		if (previousExportedURL) URL.revokeObjectURL(previousExportedURL);
		previousExportedURL = exportedURL;
		elements.virtualEepromDownloadLink.href = exportedURL;
		elements.virtualEepromDownloadLink.setAttribute("download", (exportedObject.name || "EEPROM") + ".json");
		elements.virtualEepromDownloadLink.click();
	}

	async function deleteVirtualEEPROM() {
		const id = elements.virtualEepromSelect.value;
		if (id.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
			// メモリ上のEEPROMが対象
			const id2 = parseInt(id.substring(TEMPORAL_PREFIX.length));
			if (isNaN(id2)) return;
			if (!(id2 in temporalEeproms)) return;
			const target = temporalEeproms[id2];
			if (confirm(elements.virtualEepromDeleteConfirmMessage1.textContent + target.name + elements.virtualEepromDeleteConfirmMessage2.textContent)) {
				delete temporalEeproms[id2];
			}
		} else if (db && id.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
			// DB上のEEPROMが対象
			const id2 = parseInt(id.substring(SAVED_PREFIX.length));
			if (isNaN(id2)) return;
			try {
				const tr = db.transaction([EEPROM_LIST, EEPROM_DATA], "readwrite");
				const os = tr.objectStore(EEPROM_LIST);
				const cursor = await requestAsPromise(os.openCursor(id2));
				if (cursor !== null) {
					const eepromId = cursor.key;
					const value = cursor.value;
					if (confirm(elements.virtualEepromDeleteConfirmMessage1.textContent + value.name + elements.virtualEepromDeleteConfirmMessage2.textContent)) {
						// 仮想EEPROMのリストからこの仮想EEPROMを削除する
						await requestAsPromise(cursor.delete());
						// この仮想EEPROMに保存されているデータを削除する
						const osData = tr.objectStore(EEPROM_DATA);
						await requestAsPromise(osData.delete(IDBKeyRange.bound(
							eepromId * ID_MULT_FOR_KEY, (eepromId + 1) * ID_MULT_FOR_KEY, false, true
						)));
					}
				}
			} catch (e) {
				console.warn(e);
			}
		}
		await eepromSelectUpdateOptions();
	}

	async function initialize() {
		// 利用する要素を初期化する
		document.querySelectorAll(".virtualEepromElements").forEach(function(element) {
			elements[element.id] = element;
		});
		elements.virtualEepromCreateButton.disabled = true;
		elements.virtualEepromConnectCheckbox.checked = !!parseInt(readLocalStorage("virtualEepromConnected", "0"));
		elements.virtualEepromConnectCheckbox.addEventListener("change", function() {
			writeLocalStorage("virtualEepromConnected", elements.virtualEepromConnectCheckbox.checked ? "1" : "0");
		});
		// 選択UIの幅を、選択肢が入っていないときの幅に固定する
		elements.virtualEepromSelect.style.width = elements.virtualEepromSelect.clientWidth + "px";
		elements.virtualEepromSelect.addEventListener("change", eepromSelectChangeHandler);
		eepromSelectChangeHandler();
		elements.virtualEepromCreateButton.addEventListener("click", createVirtualEEPROM);
		elements.virtualEepromImportButton.addEventListener("click", function() {
			elements.virtualEepromFileSelector.click();
		});
		elements.virtualEepromFileSelector.addEventListener("change", importVirtualEEPROM);
		elements.virtualEepromSaveButton.addEventListener("click", saveVirtualEEPROM);
		elements.virtualEepromRenameButton.addEventListener("click", renameVirtualEEPROM);
		elements.virtualEepromExportButton.addEventListener("click", exportVirtualEEPROM);
		elements.virtualEepromDeleteButton.addEventListener("click", deleteVirtualEEPROM);
		// DBに接続する
		try {
			db = await new Promise(function(resolve, reject) {
				const req = window.indexedDB.open(LOCAL_STORAGE_PREFIX + "virtualEEPROM", 1);
				req.onerror = function() {
					reject(req.error);
				};
				req.onsuccess = function() {
					resolve(req.result);
				};
				req.onupgradeneeded = function(event) {
					const eventDB = event.target.result;
					const version = event.newVersion;
					if (version >= 1) {
						eventDB.createObjectStore(EEPROM_LIST, {
							"autoIncrement": true,
						});
						eventDB.createObjectStore(EEPROM_DATA);
					}
				};
			});
			db.onclose = async function() {
				console.warn("database unexpectedly closed");
				elements.virtualEepromCreateButton.disabled = true;
				elements.virtualEepromSaveButton.disabled = true;
				db = null;
				await eepromSelectUpdateOptions();
			};
			db.onversionchange = async function() {
				console.warn("database version change requested");
				elements.virtualEepromCreateButton.disabled = true;
				elements.virtualEepromSaveButton.disabled = true;
				db.close();
				db = null;
				await eepromSelectUpdateOptions();
			}; 
			elements.virtualEepromCreateButton.disabled = false;
		} catch (e) {
			// DB接続失敗
			console.warn(e);
		}
		// 仮想EEPROMのリストを更新する
		await eepromSelectUpdateOptions(readLocalStorage("virtualEepromSelected", ""));
	}

	// メモリ上のEEPROMを追加する
	async function addTemporal(data) {
		const dataToAdd = {};
		dataToAdd.name = "name" in data ? data.name.toString() : "";
		dataToAdd.data = {};
		if ("data" in data) {
			for (let i = VALID_ID_MIN; i <= VALID_ID_MAX; i++) {
				if (i in data.data && data.data[i] instanceof Uint8Array) {
					dataToAdd.data[i] = data.data[i];
				}
			}
		}
		const key = nextTemporalEepromId++;
		temporalEeproms[key] = dataToAdd;
		await eepromSelectUpdateOptions(TEMPORAL_PREFIX + key);
		// 自動で接続する (参照したい可能性が大きいと考えられるので)
		elements.virtualEepromConnectCheckbox.checked = true;
	}

	// 仮想EEPROMが接続されていれば true、されていなければ false を返す
	function enabled() {
		return !!elements.virtualEepromConnectCheckbox.checked;
	}

	// 指定した番号 fileId からデータを読み込む
	// 成功したらそのデータ (Uint8Array) を、失敗したら null を返す
	async function load(fileId) {
		if (!enabled()) return null;
		// 番号が整数でないか範囲外の場合を弾く
		if (isNaN(fileId) || Math.floor(fileId) !== fileId || fileId < VALID_ID_MIN || VALID_ID_MAX < fileId) return null;
		const id = elements.virtualEepromSelect.value;
		if (id.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
			// メモリ上のEEPROMが対象
			const id2 = parseInt(id.substring(TEMPORAL_PREFIX.length));
			if (isNaN(id2)) return null;
			if (!(id2 in temporalEeproms)) return null;
			const target = temporalEeproms[id2];
			if (!target.data) return null;
			if (!(fileId in target.data)) return emptyData; // 読み込みには成功し、結果として空
			const data = target.data[fileId];
			if (!(data instanceof Uint8Array)) return null;
			return data;
		} else if (db && id.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
			// DB上のEEPROMが対象
			const id2 = parseInt(id.substring(SAVED_PREFIX.length));
			if (isNaN(id2)) return null;
			try {
				const tr = db.transaction(EEPROM_DATA, "readonly");
				const os = tr.objectStore(EEPROM_DATA);
				const cursor = await requestAsPromise(os.openCursor(id2 * ID_MULT_FOR_KEY + fileId));
				if (cursor !== null) {
					const data = cursor.value;
					if (!(data instanceof Uint8Array)) return null;
					return data;
				} else {
					return emptyData; // 読み込みには成功し、結果として空
				}
			} catch (e) {
				console.warn(e);
				return null;
			}
		}
	}

	// 指定した番号 fileId にデータ (Uint8Array) data を保存する
	// 成功したら true を、失敗したら false を返す
	async function save(fileId, data) {
		if (!enabled()) return false;
		// 番号が整数でないか範囲外の場合を弾く
		if (isNaN(fileId) || Math.floor(fileId) !== fileId || fileId < VALID_ID_MIN || VALID_ID_MAX < fileId) return false;
		// データが Uint8Array でない場合を弾く
		if (!(data instanceof Uint8Array)) return false;
		// データの末尾の0を省いて保存する
		let lastNonZero = -1;
		for (let i = data.length - 1; i >= 0; i--) {
			if (data[i] !== 0) {
				lastNonZero = i;
				break;
			}
		}
		const dataTrimmed = data.slice(0, lastNonZero + 1);
		let id = elements.virtualEepromSelect.value;
		if (id.substring(0, TEMPORAL_PREFIX.length) === TEMPORAL_PREFIX) {
			// メモリ上のEEPROMが対象の場合は、まずDBに保存する
			await saveVirtualEEPROM();
			id = elements.virtualEepromSelect.value;
		}
		if (db && id.substring(0, SAVED_PREFIX.length) === SAVED_PREFIX) {
			// DB上のEEPROMが対象
			const id2 = parseInt(id.substring(SAVED_PREFIX.length));
			if (isNaN(id2)) return false;
			try {
				const tr = db.transaction(EEPROM_DATA, "readwrite");
				const os = tr.objectStore(EEPROM_DATA);
				await requestAsPromise(os.put(dataTrimmed, id2 * ID_MULT_FOR_KEY + fileId));
				return true;
			} catch (e) {
				console.warn(e);
				return false;
			}
		}
		return false;
	}

	return {
		"initialize": initialize,
		"addTemporal": addTemporal,
		"getCurrentEepromData": getCurrentEepromData,
		"enabled": enabled,
		"load": load,
		"save": save,
	};
})();
