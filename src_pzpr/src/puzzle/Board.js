// Board.js v3.4.1

//---------------------------------------------------------------------------
// ★Boardクラス 盤面の情報を保持する。Cell, Cross, Borderのオブジェクトも保持する
//---------------------------------------------------------------------------
// Boardクラスの定義
pzpr.classmgr.makeCommon({
	//---------------------------------------------------------
	Board: {
		initialize: function() {
			var classes = this.klass;

			// 盤面の範囲
			this.minbx = 0;
			this.minby = 0;
			this.maxbx = 0;
			this.maxby = 0;

			// エラー設定可能状態かどうか
			this.diserror = 0;

			// エラー表示中かどうか
			this.haserror = false;

			// Info表示中かどうか
			this.hasinfo = false;

			// 盤面上にあるセル・境界線等のオブジェクト
			this.cell = new classes.CellList();
			this.cross = new classes.CrossList();
			this.border = new classes.BorderList();
			this.excell = new classes.ExCellList();

			// 空オブジェクト
			this.nullobj = new classes.BoardPiece();
			this.emptycell = new classes.Cell();
			this.emptycross = new classes.Cross();
			this.emptyborder = new classes.Border();
			this.emptyexcell = new classes.ExCell();
			try {
				Object.freeze(this.nullobj);
				Object.freeze(this.emptycell);
				Object.freeze(this.emptycross);
				Object.freeze(this.emptyborder);
				Object.freeze(this.emptyexcell);
			} catch (e) {}

			this.createExtraObject();

			// 補助オブジェクト
			this.disrecinfo = 0;
			this.infolist = [];

			this.linegraph = this.addInfoList(classes.LineGraph); // 交差なし線のグラフ
			this.roommgr = this.addInfoList(classes.AreaRoomGraph); // 部屋情報を保持する
			this.sblkmgr = this.addInfoList(classes.AreaShadeGraph); // 黒マス情報を保持する
			this.ublkmgr = this.addInfoList(classes.AreaUnshadeGraph); // 白マス情報を保持する
			this.nblkmgr = this.addInfoList(classes.AreaNumberGraph); // 数字情報を保持する

			if (classes.Bank.prototype.enabled) {
				this.bank = new classes.Bank();
				this.bank.init();
				this.bank.initialize(this.bank.defaultPreset());
			}

			this.addExtraInfo();

			this.exec = new classes.BoardExec();
			this.exec.insex.cross = this.hascross === 1 ? { 2: true } : { 0: true };

			this.trialstage = 0; // TrialMode
		},
		addInfoList: function(Klass) {
			var instance = new Klass();
			if (instance.enabled) {
				this.infolist.push(instance);
			}
			return instance;
		},
		addExtraInfo: function() {},

		cols: 10 /* 盤面の横幅(デフォルト) */,
		rows: 10 /* 盤面の縦幅(デフォルト) */,

		hascross: 2, // 1:盤面内側のCrossが操作可能なパズル 2:外枠上を含めてCrossが操作可能なパズル (どちらもCrossは外枠上に存在します)
		hasborder: 0, // 1:Border/Lineが操作可能なパズル 2:外枠上も操作可能なパズル
		hasexcell: 0, // 1:上・左側にセルを用意するパズル 2:四方にセルを用意するパズル
		hasflush: 0,
		borderAsLine: false, // 境界線をlineとして扱う
		disable_subclear: false, // "補助消去"ボタン不要

		excellRows: function(cols, rows) {
			return 1;
		},
		excellCols: function(cols, rows) {
			return 1;
		},

		autoSolve: function(force) {
			var updateCells = this.pid === "nurimisaki" || this.pid === "nurikabe" ||
				this.pid === "lits" || this.pid === "heyawake" || 
				this.pid === "yajilin" || this.pid === "anymino" || 
				this.pid === "guidearrow" || this.pid === "shakashaka" ||
				this.pid === "lightup" || this.pid === "shugaku";
			var updateBorders = this.pid === "slither" || this.pid === "mashu" || this.pid === "yajilin";
			if (!this.is_autosolve && !force) {
				// clear solver answers if necessary
				var needUpdateField = false;
				if (updateCells && this.clearSolverAnswerForCells()) {
					needUpdateField = true;
				}
				if (updateBorders && this.clearSolverAnswerForBorders()) {
					needUpdateField = true;
				}
				if (needUpdateField) {
					this.puzzle.painter.paintAll();
				}
				return;
			}
			var url = ui.puzzle.getURL(pzpr.parser.URL_PZPRV3);
			var result = window.solveProblem(url);

			if (updateCells) {
				this.updateSolverAnswerForCells(result);
			}
			if (updateBorders) {
				this.updateSolverAnswerForBorders(result);
			}

			this.puzzle.painter.paintAll();
		},

		clearSolverAnswerForCells: function () {
			var needUpdateField = false;

			for (var i = 0; i < this.cell.length; ++i) {
				var cell = this.cell[i];
				if (cell.qansBySolver !== 0 || cell.qsubBySolver !== 0) {
					cell.qansBySolver = 0;
					cell.qsubBySolver = 0;
					needUpdateField = true;
				}
			}
			return needUpdateField;
		},

		updateSolverAnswerForCells: function(result) {
			// 既存のソルバーによる解答を一旦クリアする
			this.clearSolverAnswerForCells();

			// resultがオブジェクトの場合、詳細な解答データを処理する
			if (typeof result !== "string") {
				// 各セルに対応するアイテムを格納するための2次元配列を初期化
				const cellItems = [];
				for (let rowIndex = 0; rowIndex < this.rows; ++rowIndex) {
					const row = [];
					for (let colIndex = 0; colIndex < this.cols; ++colIndex) {
						row.push([]);
					}
					cellItems.push(row);
				}

				// 解答データをループし、対応するセルにアイテムを振り分ける
				const solverData = result.data;
				for (let i = 0; i < solverData.length; ++i) {
					const itemData = solverData[i];

					// アイテムの色が'green'で、座標がセルの中心を示す場合 (x, yが共に奇数)
					if (itemData.color === "green" && itemData.x % 2 === 1 && itemData.y % 2 === 1) {
						// パズルの内部座標からセルのインデックスに変換
						const cellY = (itemData.y - 1) / 2;
						const cellX = (itemData.x - 1) / 2;
						cellItems[cellY][cellX].push(itemData.item);
					}
				}

				// 盤面の全セルをループして、ソルバーの解答をセットする
				for (let i = 0; i < this.cell.length; ++i) {
					const cell = this.cell[i];

					// セルの内部座標 (bx, by) からセルのインデックスに変換
					const cellY = (cell.by - 1) / 2;
					const cellX = (cell.bx - 1) / 2;
					const itemsInCell = cellItems[cellY][cellX];

					// セルに割り当てられたアイテムの種類に応じて、セルの状態を更新
					for (let k = 0; k < itemsInCell.length; ++k) {
						const item = itemsInCell[k];

						// アイテムがオブジェクトでない場合（単純な文字列）
						if (typeof item === 'string') {
							switch (item) {
								case "block":
								case "fill":
								case "circle":
									cell.qansBySolver = 1;
									break;
								case "dot":
									cell.qsubBySolver = 1;
									break;
								case "aboloUpperLeft":
									cell.qansBySolver = 5;
									break;
								case "aboloUpperRight":
									cell.qansBySolver = 4;
									break;
								case "aboloLowerLeft":
									cell.qansBySolver = 2;
									break;
								case "aboloLowerRight":
									cell.qansBySolver = 3;
									break;
								case "shugakuPillow":
									cell.qansBySolver = 40;
									break;
								case "shugakuFuton":
									cell.qansBySolver = 50;
									break;
								case "shugakuWest":
									cell.qsubBySolver = 1;
									break;
								case "shugakuEast":
									cell.qsubBySolver = 2;
									break;
								case "shugakuSouth":
									cell.qsubBySolver = 3;
									break;
										
							}
						}
						// アイテムが 'kind' プロパティを持つオブジェクトの場合
						else if (item && item.kind) {
							switch (item.kind) {
								case "text":
									cell.qansBySolver = parseInt(item.data, 10);
									break;
								case "sudokuCandidateSet": // 数独の候補数字など
									cell.qcandBySolver = [];
									for (let n = 0; n < this.rows; ++n) {
										cell.qcandBySolver.push(false);
									}
									for (let n = 0; n < item.values.length; ++n) {
										const value = item.values[n];
										if (value >= 1 && value <= this.rows) {
											cell.qcandBySolver[value - 1] = true;
										}
									}
									break;
							}
						}
					}
				}
			}
			// resultが文字列の場合、特定のパターンで盤面を塗りつぶす
			else {
				// パズルの種類 (pid) によってデフォルト値を変える
				// "shakashaka" なら 2、それ以外なら 1
				const defaultValue = (this.pid === "shakashaka") ? 2 : 1;

				for (let i = 0; i < this.cell.length; ++i) {
					const cell = this.cell[i];
					const cellY = (cell.by - 1) / 2;
					const cellX = (cell.bx - 1) / 2;

					// セルのX座標とY座標の偶奇が一致する場合 (市松模様)
					if (cellY % 2 === cellX % 2) {
						cell.qansBySolver = defaultValue;
					}
				}
			}
		},
		
		clearSolverAnswerForBorders: function () {
			var needUpdateField = false;

			for (var i = 0; i < this.border.length; ++i) {
				var border = this.border[i];
				if (border.lineBySolver !== 0 || border.qsubBySolver !== 0) {
					border.lineBySolver = 0;
					border.qsubBySolver = 0;
					needUpdateField = true;
				}
			}
			return needUpdateField;
		},

		updateSolverAnswerForBorders: function (result) {
			this.clearSolverAnswerForBorders();
			if (typeof result === "string") {
				for (var i = 0; i < this.border.length; ++i) {
					var border = this.border[i];
					border.qsubBySolver = 2;
				}
				return;
			}

			var dataByBorder = [];
			for (var y = 0; y < this.rows * 2 + 1; ++y) {
				var row = [];
				for (var x = 0; x < this.cols * 2 + 1; ++x) {
					row.push([]);
				}
				dataByBorder.push(row);
			}
			var dataRaw = result.data;
			for (var i = 0; i < dataRaw.length; ++i) {
				var elem = dataRaw[i];
				if (elem.color !== "green") { // TODO
					continue;
				}
				if (elem.x % 2 === elem.y % 2) {
					continue;
				}
				dataByBorder[elem.y][elem.x].push(elem.item);
			}
			for (var i = 0; i < this.border.length; ++i) {
				var border = this.border[i];
				var data = dataByBorder[border.by][border.bx];

				for (var j = 0; j < data.length; ++j) {
					if (data[j] === "line" || data[j] === "wall") {
						border.lineBySolver = 1;
					} else if (data[j] === "cross") {
						border.qsubBySolver = 2;
					}
				}
			}
		},
		
		showAnswer: function() {
			// 表示すべき解答データ (this.answers) がなければ何もしない
			if (!this.answers) {
				return;
			}

			let answerData;
			let totalAnswers;
			const currentIndex = this.answerIndex;

			// this.answers の型に応じて、表示するデータと総解答数を設定する
			if (typeof this.answers === 'string') {
				// 解答が単一の文字列の場合 (例: "terminated")
				answerData = this.answers;
				totalAnswers = 0; // 総数は意味を持たない
			} else {
				// 解答が複数あるオブジェクトの場合
				answerData = this.answers.answers[currentIndex];
				totalAnswers = this.answers.answers.length;
			}

			// UI上の「n/m」カウンター表示を更新する
			const locatorElement = ui.popupmgr.popups.auxeditor.pop.querySelector(".solver-answer-locator");
			if (answerData === "terminated") {
				locatorElement.innerText = "Terminated";
			} else if (totalAnswers > 0) {
				locatorElement.innerText = `${currentIndex + 1}/${totalAnswers}`;
			}

			// 特定のパズル("numlin-aux")の場合、境界線の状態も更新する
			if (this.pid === "numlin-aux") {
				// 以前に解析した関数を呼び出す
				this.updateSolverAnswerForBorders(answerData);
			}

			// 盤面全体を再描画して、変更を画面に反映させる
			this.puzzle.painter.paintAll();
		},

		locateAnswer: function(direction) {
			// 解答データがなければ何もしない
			if (this.answers === null) {
				return;
			}

			// 解答の総数を取得
			const totalAnswers = (typeof this.answers === 'string') ? 0 : this.answers.answers.length;

			// 移動方向に応じて、表示する解答のインデックスを変更する
			switch (direction) {
				case -2: // 「最初へ」
					this.answerIndex = 0;
					break;

				case -1: // 「前へ」
					this.answerIndex--;
					if (this.answerIndex < 0) {
						this.answerIndex = 0; // 0より小さくはならない
					}
					break;

				case 1: // 「次へ」
					this.answerIndex++;
					if (this.answerIndex >= totalAnswers) {
						// 総数を超えないように、最後のインデックスに留める
						this.answerIndex = totalAnswers > 0 ? totalAnswers - 1 : 0;
					}
					break;

				default: // 「最後へ」 (directionが上記以外の値の場合)
					this.answerIndex = totalAnswers > 0 ? totalAnswers - 1 : 0;
					break;
			}

			// 新しいインデックスに基づいて解答の表示を更新する
			this.showAnswer();
		},
		
		is_autosolve: false,
		updateIsAutosolve: function(mode) {
			if (this.is_autosolve !== mode) {
				this.is_autosolve = mode;
				this.autoSolve();
			}
		},

		//---------------------------------------------------------------------------
		// bd.initBoardSize() 指定されたサイズで盤面の初期化を行う
		//---------------------------------------------------------------------------
		initBoardSize: function(col, row) {
			if (col === void 0 || isNaN(col)) {
				col = this.cols;
				row = this.rows;
			}

			this.allclear(false); // initGroupで、新Objectに対しては別途allclearが呼ばれます

			this.initGroup("cell", col, row);
			this.initGroup("cross", col, row);
			this.initGroup("border", col, row);
			this.initGroup("excell", col, row);

			this.cols = col;
			this.rows = row;
			this.setminmax();
			this.setposAll();

			if (this.hasdots) {
				this.initDots(this.cols, this.rows, this.hasdots === 2);
			}

			this.initExtraObject(col, row);

			if (this.bank) {
				this.bank.width = this.cols / this.puzzle.painter.bankratio;
				this.bank.performLayout();
			}

			this.rebuildInfo();

			this.puzzle.cursor.initCursor();
			this.puzzle.opemgr.allerase();
		},
		createExtraObject: function() {},
		initExtraObject: function(col, row) {},

		//---------------------------------------------------------------------------
		// bd.getBankPiecesInGrid(): Returns an array of [strings, PieceList] tuples
		// which can be compared to the pieces inside the bank.
		//---------------------------------------------------------------------------
		getBankPiecesInGrid: function() {
			return [];
		},

		//---------------------------------------------------------------------------
		// bd.initGroup()     数を比較して、オブジェクトの追加か削除を行う
		// bd.getGroup()      指定したタイプのオブジェクト配列を返す
		// bd.estimateSize()  指定したオブジェクトがいくつになるか計算を行う
		// bd.newObject()     指定されたタイプの新しいオブジェクトを返す
		//---------------------------------------------------------------------------
		initGroup: function(group, col, row) {
			var groups = this.getGroup(group);
			var len = this.estimateSize(group, col, row),
				clen = groups.length;
			// 既存のサイズより小さくなるならdeleteする
			if (clen > len) {
				for (var id = clen - 1; id >= len; id--) {
					groups.pop();
				}
			}
			// 既存のサイズより大きくなるなら追加する
			else if (clen < len) {
				var groups2 = new groups.constructor();
				for (var id = clen; id < len; id++) {
					var piece = this.newObject(group, id);
					groups.add(piece);
					groups2.add(piece);
				}
				groups2.allclear(false);
			}
			groups.length = len;
			
			for (let i = 0; i < group.length; i++) {
				const element = group[i];
				element.qansBySolver = 0;
				element.qsubBySolver = 0;
				element.lineBySolver = 0;
				element.qcandBySolver = null;
			}
			
			return len - clen;
		},
		getGroup: function(group) {
			if (group === "cell") {
				return this.cell;
			} else if (group === "cross") {
				return this.cross;
			} else if (group === "border") {
				return this.border;
			} else if (group === "excell") {
				return this.excell;
			}
			return new this.klass.PieceList();
		},
		estimateSize: function(group, col, row) {
			if (group === "cell") {
				return col * row;
			} else if (group === "cross") {
				return (col + 1) * (row + 1);
			} else if (group === "border") {
				if (this.hasborder === 1) {
					return 2 * col * row - (col + row);
				} else if (this.hasborder === 2) {
					return 2 * col * row + (col + row);
				}
			} else if (group === "excell") {
				if (this.hasexcell === 1) {
					var exrows = this.excellRows(col, row);
					var excols = this.excellCols(col, row);
					col *= exrows;
					row *= excols;
					return col + row + (this.emptyexcell.ques === 51 ? 1 : 0);
				} /* 左上角のExCellを追加 */ else if (this.hasexcell === 2) {
					return 2 * (col + row);
				}
			}
			return 0;
		},
		newObject: function(group, id) {
			var piece = this.nullobj,
				classes = this.klass;
			if (group === "cell") {
				piece = new classes.Cell();
			} else if (group === "cross") {
				piece = new classes.Cross();
			} else if (group === "border") {
				piece = new classes.Border();
			} else if (group === "excell") {
				piece = new classes.ExCell();
			}
			if (piece !== this.nullobj && id !== void 0) {
				piece.id = id;
			}
			return piece;
		},

		//---------------------------------------------------------------------------
		// bd.setposAll()    全てのCell, Cross, BorderオブジェクトのsetposCell()等を呼び出す
		//                   盤面の新規作成や、拡大/縮小/回転/反転時などに呼び出される
		// bd.setposGroup()  指定されたタイプのsetpos関数を呼び出す
		// bd.setposCell()   該当するidのセルのbx,byプロパティを設定する
		// bd.setposCross()  該当するidの交差点のbx,byプロパティを設定する
		// bd.setposBorder() 該当するidの境界線/Lineのbx,byプロパティを設定する
		// bd.setposExCell() 該当するidのExtendセルのbx,byプロパティを設定する
		// bd.set_xnum()     crossは存在しないが、bd._xnumだけ設定したい場合に呼び出す
		//---------------------------------------------------------------------------
		/* setpos関連関数 */
		setposAll: function() {
			this.setposCells();
			this.setposCrosses();
			this.setposBorders();
			this.setposExCells();
		},
		setposGroup: function(group) {
			if (group === "cell") {
				this.setposCells();
			} else if (group === "cross") {
				this.setposCrosses();
			} else if (group === "border") {
				this.setposBorders();
			} else if (group === "excell") {
				this.setposExCells();
			}
		},

		setposCells: function() {
			var qc = this.cols;
			for (var id = 0; id < this.cell.length; id++) {
				var cell = this.cell[id];
				cell.id = id;
				cell.isnull = false;

				cell.bx = (id % qc) * 2 + 1;
				cell.by = ((id / qc) << 1) + 1;

				cell.initAdjacent();
				cell.initAdjBorder();
			}
		},
		setposCrosses: function() {
			var qc = this.cols;
			for (var id = 0; id < this.cross.length; id++) {
				var cross = this.cross[id];
				cross.id = id;
				cross.isnull = false;

				cross.bx = (id % (qc + 1)) * 2;
				cross.by = (id / (qc + 1)) << 1;

				cross.initAdjBorder();
			}
		},
		setposBorders: function() {
			var qc = this.cols,
				qr = this.rows;
			var bdinside = 2 * qc * qr - qc - qr;
			for (var id = 0; id < this.border.length; id++) {
				var border = this.border[id],
					i = id;
				border.id = id;
				border.isnull = false;

				if (i >= 0 && i < (qc - 1) * qr) {
					border.bx = (i % (qc - 1)) * 2 + 2;
					border.by = ((i / (qc - 1)) << 1) + 1;
				}
				i -= (qc - 1) * qr;
				if (i >= 0 && i < qc * (qr - 1)) {
					border.bx = (i % qc) * 2 + 1;
					border.by = ((i / qc) << 1) + 2;
				}
				i -= qc * (qr - 1);
				if (this.hasborder === 2) {
					if (i >= 0 && i < qc) {
						border.bx = i * 2 + 1;
						border.by = 0;
					}
					i -= qc;
					if (i >= 0 && i < qc) {
						border.bx = i * 2 + 1;
						border.by = 2 * qr;
					}
					i -= qc;
					if (i >= 0 && i < qr) {
						border.bx = 0;
						border.by = i * 2 + 1;
					}
					i -= qr;
					if (i >= 0 && i < qr) {
						border.bx = 2 * qc;
						border.by = i * 2 + 1;
					}
					i -= qr;
				}
				border.isvert = !(border.bx & 1);
				border.inside = id < bdinside;

				border.initSideObject();
			}
		},
		setposExCells: function() {
			var exrows = this.excellRows(this.cols, this.rows),
				excols = this.excellCols(this.cols, this.rows),
				qc = this.cols * exrows,
				qr = this.rows * excols;
			for (var id = 0; id < this.excell.length; id++) {
				var excell = this.excell[id],
					i = id;
				excell.id = id;
				excell.isnull = false;

				if (this.hasexcell === 1) {
					if (i >= 0 && i < qc) {
						excell.bx = ((i / exrows) | 0) * 2 + 1;
						excell.by = (i % exrows) * -2 - 1;
					}
					i -= qc;
					if (i >= 0 && i < qr) {
						excell.bx = (i % excols) * -2 - 1;
						excell.by = ((i / excols) | 0) * 2 + 1;
					}
					i -= qr;
					if (i === 0 && excell.ques === 51) {
						excell.bx = -1;
						excell.by = -1;
					}
					i--; /* 左上角のExCellを追加 */
				} else if (this.hasexcell === 2) {
					if (i >= 0 && i < qc) {
						excell.bx = i * 2 + 1;
						excell.by = -1;
					}
					i -= qc;
					if (i >= 0 && i < qc) {
						excell.bx = i * 2 + 1;
						excell.by = 2 * qr + 1;
					}
					i -= qc;
					if (i >= 0 && i < qr) {
						excell.bx = -1;
						excell.by = i * 2 + 1;
					}
					i -= qr;
					if (i >= 0 && i < qr) {
						excell.bx = 2 * qc + 1;
						excell.by = i * 2 + 1;
					}
					i -= qr;
				}

				excell.initAdjacent();
			}
		},

		//---------------------------------------------------------------------------
		// bd.setminmax()   盤面のbx,byの最小値/最大値をセットする
		//---------------------------------------------------------------------------
		setminmax: function() {
			var extUL = this.hasexcell > 0;
			var extDR = this.hasexcell === 2;
			this.minbx = !extUL ? 0 : -2 * this.excellCols(this.cols, this.rows);
			this.minby = !extUL ? 0 : -2 * this.excellRows(this.cols, this.rows);
			this.maxbx = !extDR ? 2 * this.cols : 2 * this.cols + 2;
			this.maxby = !extDR ? 2 * this.rows : 2 * this.rows + 2;

			this.puzzle.cursor.setminmax();
		},

		//---------------------------------------------------------------------------
		// bd.allclear() 全てのCell, Cross, Borderオブジェクトのallclear()を呼び出す
		// bd.ansclear() 全てのCell, Cross, Borderオブジェクトのansclear()を呼び出す
		// bd.subclear() 全てのCell, Cross, Borderオブジェクトのsubclear()を呼び出す
		// bd.errclear() 全てのCell, Cross, Borderオブジェクトのerrorプロパティを0にして、Canvasを再描画する
		// bd.trialclear() 全てのCell, Cross, Borderオブジェクトのtrialプロパティを0にして、Canvasを再描画する
		//---------------------------------------------------------------------------
		// 呼び出し元：this.initBoardSize()
		allclear: function(isrec) {
			this.cell.allclear(isrec);
			this.cross.allclear(isrec);
			this.border.allclear(isrec);
			this.excell.allclear(isrec);
			if (isrec) {
				this.puzzle.opemgr.rejectTrial(true);
			}
		},
		// 呼び出し元：回答消去ボタン押した時
		ansclear: function() {
			var opemgr = this.puzzle.opemgr;
			opemgr.rejectTrial(true);
			opemgr.newOperation();
			opemgr.add(new this.puzzle.klass.BoardClearOperation());

			this.cell.ansclear();
			this.cross.ansclear();
			this.border.ansclear();
			this.excell.ansclear();
			if (this.bank) {
				this.bank.ansclear();
			}
			this.rebuildInfo();
		},
		// 呼び出し元：補助消去ボタン押した時
		subclear: function() {
			this.puzzle.opemgr.newOperation();

			this.cell.subclear();
			this.cross.subclear();
			this.border.subclear();
			this.excell.subclear();
			if (this.bank) {
				this.bank.subclear();
			}
			this.rebuildInfo();
		},

		errclear: function() {
			var isclear = this.haserror || this.hasinfo;
			if (isclear) {
				this.cell.errclear();
				this.cross.errclear();
				this.border.errclear();
				this.excell.errclear();
				if (this.bank) {
					this.bank.errclear();
				}
				this.haserror = false;
				this.hasinfo = false;
			}
			return isclear;
		},

		trialclear: function(forcemode) {
			if (this.trialstage > 0 || !!forcemode) {
				this.cell.trialclear();
				this.cross.trialclear();
				this.border.trialclear();
				this.excell.trialclear();
				this.puzzle.redraw();
				this.trialstage = 0;
			}
		},

		//---------------------------------------------------------------------------
		// bd.getObjectPos()  (X,Y)の位置にあるオブジェクトを計算して返す
		//---------------------------------------------------------------------------
		getObjectPos: function(group, bx, by) {
			var obj = this.nullobj;
			if (group === "cell") {
				obj = this.getc(bx, by);
			} else if (group === "cross") {
				obj = this.getx(bx, by);
			} else if (group === "border") {
				obj = this.getb(bx, by);
			} else if (group === "excell") {
				obj = this.getex(bx, by);
			} else if (group === "obj") {
				obj = this.getobj(bx, by);
			}
			return obj;
		},

		//---------------------------------------------------------------------------
		// bd.getc()  (X,Y)の位置にあるCellオブジェクトを返す
		// bd.getx()  (X,Y)の位置にあるCrossオブジェクトを返す
		// bd.getb()  (X,Y)の位置にあるBorderオブジェクトを返す
		// bd.getex() (X,Y)の位置にあるextendCellオブジェクトを返す
		// bd.getobj() (X,Y)の位置にある何らかのオブジェクトを返す
		//---------------------------------------------------------------------------
		getc: function(bx, by) {
			var id = null,
				qc = this.cols,
				qr = this.rows;
			if (
				bx < 0 ||
				bx > qc << 1 ||
				by < 0 ||
				by > qr << 1 ||
				!(bx & 1) ||
				!(by & 1)
			) {
			} else {
				id = (bx >> 1) + (by >> 1) * qc;
			}

			return id !== null ? this.cell[id] : this.emptycell;
		},
		getx: function(bx, by) {
			var id = null,
				qc = this.cols,
				qr = this.rows;
			if (
				bx < 0 ||
				bx > qc << 1 ||
				by < 0 ||
				by > qr << 1 ||
				!!(bx & 1) ||
				!!(by & 1)
			) {
			} else {
				id = (bx >> 1) + (by >> 1) * (qc + 1);
			}

			if (this.hascross !== 0) {
				return id !== null ? this.cross[id] : this.emptycross;
			}
			return this.emptycross;
		},
		getb: function(bx, by) {
			var id = null,
				qc = this.cols,
				qr = this.rows;
			if (
				!!this.hasborder &&
				bx >= 1 &&
				bx <= 2 * qc - 1 &&
				by >= 1 &&
				by <= 2 * qr - 1
			) {
				if (!(bx & 1) && by & 1) {
					id = (bx >> 1) - 1 + (by >> 1) * (qc - 1);
				} else if (bx & 1 && !(by & 1)) {
					id = (bx >> 1) + ((by >> 1) - 1) * qc + (qc - 1) * qr;
				}
			} else if (this.hasborder === 2) {
				if (by === 0 && bx & 1 && bx >= 1 && bx <= 2 * qc - 1) {
					id = (qc - 1) * qr + qc * (qr - 1) + (bx >> 1);
				} else if (by === 2 * qr && bx & 1 && bx >= 1 && bx <= 2 * qc - 1) {
					id = (qc - 1) * qr + qc * (qr - 1) + qc + (bx >> 1);
				} else if (bx === 0 && by & 1 && by >= 1 && by <= 2 * qr - 1) {
					id = (qc - 1) * qr + qc * (qr - 1) + 2 * qc + (by >> 1);
				} else if (bx === 2 * qc && by & 1 && by >= 1 && by <= 2 * qr - 1) {
					id = (qc - 1) * qr + qc * (qr - 1) + 2 * qc + qr + (by >> 1);
				}
			}

			return id !== null ? this.border[id] : this.emptyborder;
		},
		getex: function(bx, by) {
			var xr = this.excellRows(this.cols, this.rows);
			var xc = this.excellCols(this.cols, this.rows);
			var id = null,
				qc = this.cols * xr,
				qr = this.rows * xc;

			if (this.hasexcell === 1) {
				if (this.emptyexcell.ques === 51 && bx === -1 && by === -1) {
					id = qc + qr; /* 左上角のExCellを追加 */
				} else if (by >= this.minby && by < 0 && bx > 0 && bx < 2 * qc) {
					id = (-by >> 1) + (bx >> 1) * xr;
				} else if (bx >= this.minbx && bx < 0 && by > 0 && by < 2 * qr) {
					id = (-bx >> 1) + qc + (by >> 1) * xc;
				}
			} else if (this.hasexcell === 2) {
				if (by === -1 && bx > 0 && bx < 2 * qc) {
					id = bx >> 1;
				} else if (by === 2 * qr + 1 && bx > 0 && bx < 2 * qc) {
					id = qc + (bx >> 1);
				} else if (bx === -1 && by > 0 && by < 2 * qr) {
					id = 2 * qc + (by >> 1);
				} else if (bx === 2 * qc + 1 && by > 0 && by < 2 * qr) {
					id = 2 * qc + qr + (by >> 1);
				}
			}

			return id !== null ? this.excell[id] : this.emptyexcell;
		},

		getobj: function(bx, by) {
			if ((bx + by) & 1) {
				return this.getb(bx, by);
			} else if (!(bx & 1) && !(by & 1)) {
				return this.getx(bx, by);
			}

			var cell = this.getc(bx, by);
			return cell !== this.emptycell || !this.hasexcell
				? cell
				: this.getex(bx, by);
		},

		//---------------------------------------------------------------------------
		// bd.operate()  BoardExecの拡大縮小・回転反転処理を実行する
		//---------------------------------------------------------------------------
		operate: function(type) {
			if (this.trialstage > 0 && this.exec.isBoardOp(type)) {
				throw Error("board operations are not possible in trial mode");
			}
			this.exec.execadjust(type);
		},

		flushexcell: function() {
			this.puzzle.opemgr.newOperation();
			var cols = this.cols,
				rows = this.rows,
				excell = this.excell;
			this.genericFlush(
				this.excellCols(cols, rows),
				this.excellRows(cols, rows),
				cols,
				rows,
				function(i) {
					return excell[i].qnum;
				},
				function(i, num) {
					excell[i].setQcmp(0);
					excell[i].setQnum(num);
				}
			);
			this.puzzle.redraw();
		},

		genericFlush: function(excols, exrows, cols, rows, get_func, set_func) {
			var qc = cols * exrows,
				qr = rows * excols,
				dest = 0;

			for (var id = 0; id < qc + qr; id++) {
				if (get_func(id) !== -1) {
					if (id !== dest - 1) {
						set_func(dest, get_func(id));
					}
					dest++;
				}

				if (
					(id < qc && id % exrows === exrows - 1) ||
					(id >= qc && (id - qc) % excols === excols - 1)
				) {
					for (var b = dest; b <= id; b++) {
						set_func(b, -1);
					}
					dest = id + 1;
				}
			}
		},

		//---------------------------------------------------------------------------
		// bd.objectinside() 座標(x1,y1)-(x2,y2)に含まれるオブジェクトのリストを取得する
		//---------------------------------------------------------------------------
		objectinside: function(group, x1, y1, x2, y2) {
			if (group === "cell") {
				return this.cellinside(x1, y1, x2, y2);
			} else if (group === "cross") {
				return this.crossinside(x1, y1, x2, y2);
			} else if (group === "border") {
				return this.borderinside(x1, y1, x2, y2);
			} else if (group === "excell") {
				return this.excellinside(x1, y1, x2, y2);
			}
			return new this.klass.PieceList();
		},

		//---------------------------------------------------------------------------
		// bd.cellinside()   座標(x1,y1)-(x2,y2)に含まれるCellのリストを取得する
		// bd.crossinside()  座標(x1,y1)-(x2,y2)に含まれるCrossのリストを取得する
		// bd.borderinside() 座標(x1,y1)-(x2,y2)に含まれるBorderのリストを取得する
		// bd.excellinside() 座標(x1,y1)-(x2,y2)に含まれるExCellのリストを取得する
		//---------------------------------------------------------------------------
		cellinside: function(x1, y1, x2, y2) {
			var clist = new this.klass.CellList();
			for (var by = y1 | 1; by <= y2; by += 2) {
				for (var bx = x1 | 1; bx <= x2; bx += 2) {
					var cell = this.getc(bx, by);
					if (!cell.isnull) {
						clist.add(cell);
					}
				}
			}
			return clist;
		},
		crossinside: function(x1, y1, x2, y2) {
			var clist = new this.klass.CrossList();
			if (!!this.hascross) {
				for (var by = y1 + (y1 & 1); by <= y2; by += 2) {
					for (var bx = x1 + (x1 & 1); bx <= x2; bx += 2) {
						var cross = this.getx(bx, by);
						if (!cross.isnull) {
							clist.add(cross);
						}
					}
				}
			}
			return clist;
		},
		borderinside: function(x1, y1, x2, y2) {
			var blist = new this.klass.BorderList();
			if (!!this.hasborder) {
				for (var by = y1; by <= y2; by++) {
					for (var bx = x1 + (((x1 + by) & 1) ^ 1); bx <= x2; bx += 2) {
						var border = this.getb(bx, by);
						if (!border.isnull) {
							blist.add(border);
						}
					}
				}
			}
			return blist;
		},
		excellinside: function(x1, y1, x2, y2) {
			var exlist = new this.klass.ExCellList();
			if (!!this.hasexcell) {
				for (var by = y1 | 1; by <= y2; by += 2) {
					for (var bx = x1 | 1; bx <= x2; bx += 2) {
						var excell = this.getex(bx, by);
						if (excell && !excell.isnull) {
							exlist.add(excell);
						}
					}
				}
			}
			return exlist;
		},

		//---------------------------------------------------------------------------
		// bd.disableInfo()  Area/LineManagerへの登録を禁止する
		// bd.enableInfo()   Area/LineManagerへの登録を許可する
		// bd.isenableInfo() 操作の登録できるかを返す
		//---------------------------------------------------------------------------
		disableInfo: function() {
			this.puzzle.opemgr.disableRecord();
			this.disrecinfo++;
		},
		enableInfo: function() {
			this.puzzle.opemgr.enableRecord();
			if (this.disrecinfo > 0) {
				this.disrecinfo--;
			}
		},
		isenableInfo: function() {
			return this.disrecinfo === 0;
		},

		//--------------------------------------------------------------------------------
		// bd.rebuildInfo()      部屋、黒マス、白マスの情報を再生成する
		// bd.modifyInfo()       黒マス・白マス・境界線や線が入力されたり消された時に情報を変更する
		//--------------------------------------------------------------------------------
		rebuildInfo: function() {
			if (this.bank) {
				this.bank.rebuildExtraData();
			}
			this.infolist.forEach(function(info) {
				info.rebuild();
			});
		},
		modifyInfo: function(obj, type) {
			if (!this.isenableInfo()) {
				return;
			}
			for (var i = 0; i < this.infolist.length; ++i) {
				var info = this.infolist[i];
				if (!!info.relation[type]) {
					info.modifyInfo(obj, type);
				}
			}
		},

		//---------------------------------------------------------------------------
		// bd.irowakeRemake() 「色分けしなおす」ボタンを押した時などに色分けしなおす
		//---------------------------------------------------------------------------
		irowakeRemake: function() {
			for (var i = 0; i < this.infolist.length; ++i) {
				var info = this.infolist[i];
				if (info.coloring) {
					info.newIrowake();
				}
			}
		},

		//---------------------------------------------------------------------------
		// bd.disableSetError()  盤面のオブジェクトにエラーフラグを設定できないようにする
		// bd.enableSetError()   盤面のオブジェクトにエラーフラグを設定できるようにする
		// bd.isenableSetError() 盤面のオブジェクトにエラーフラグを設定できるかどうかを返す
		//---------------------------------------------------------------------------
		disableSetError: function() {
			this.diserror++;
		},
		enableSetError: function() {
			this.diserror--;
		},
		isenableSetError: function() {
			return this.diserror <= 0;
		},

		//---------------------------------------------------------------------------
		// bd.freezecopy()  盤面のオブジェクト値のみを取得する
		// bd.compareData() 盤面のオブジェクト値のみを比較し異なる場合にcallback関数を呼ぶ
		//---------------------------------------------------------------------------
		freezecopy: function() {
			var bd2 = { cell: [], cross: [], border: [], excell: [] };
			for (var group in bd2) {
				for (var c = 0; c < this[group].length; c++) {
					bd2[group][c] = this[group][c].getprops();
				}
			}
			return bd2;
		},
		compareData: function(bd2, callback) {
			for (var group in bd2) {
				if (!this[group]) {
					continue;
				}
				for (var c = 0; c < bd2[group].length; c++) {
					if (!this[group][c]) {
						continue;
					}
					this[group][c].compare(bd2[group][c], callback);
				}
			}
		},

		dotsmax: 0,
		dots: [],

		//---------------------------------------------------------------------------
		initDots: function(col, row, outer) {
			var width = 2 * col + (outer ? 1 : -1);
			var height = 2 * row + (outer ? 1 : -1);
			this.dotsmax = width * height;
			this.dots = [];
			for (var id = 0; id < this.dotsmax; id++) {
				this.dots[id] = new this.klass.Dot();
				var dot = this.dots[id];
				dot.id = id;

				dot.bx = (id % width) + (outer ? 0 : 1);
				dot.by = ((id / width) | 0) + (outer ? 0 : 1);

				dot.isnull = false;
				dot.piece = dot.getaddr().getobj();
			}
		},

		getDot: function(bx, by) {
			var qc = this.cols,
				qr = this.rows,
				id = -1;

			if (this.hasdots === 1) {
				if (bx <= 0 || bx >= qc << 1 || by <= 0 || by >= qr << 1) {
					return null;
				}
				id = bx - 1 + (by - 1) * (2 * qc - 1);
			}
			if (this.hasdots === 2) {
				if (bx < 0 || bx > qc << 1 || by < 0 || by > qr << 1) {
					return null;
				}
				id = bx + by * (2 * qc + 1);
			}
			if (id === -1) {
				return null;
			}
			var dot = this.dots[id];
			return dot.isnull ? null : dot;
		},

		dotinside: function(x1, y1, x2, y2) {
			var dlist = new this.klass.PieceList();
			for (var by = y1; by <= y2; by++) {
				for (var bx = x1; bx <= x2; bx++) {
					var dot = this.getDot(bx, by);
					if (!!dot) {
						dlist.add(dot);
					}
				}
			}
			return dlist;
		}
	}
});
