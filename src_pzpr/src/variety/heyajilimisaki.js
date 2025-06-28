(function (pidlist, classbase) {
	if (typeof module === "object" && module.exports) {
		module.exports = [pidlist, classbase];
	} else {
		pzpr.classmgr.makeCustom(pidlist, classbase);
	}
})(["heyajilimisaki"], {
	//---------------------------------------------------------
	// マウス入力系
	MouseEvent: {
		RBShadeCell: true,
		use: true,
		// mouseinput_auto: function () {
		// 	if (this.puzzle.playmode) {
		// 		if (this.mousestart || this.mousemove) {
		// 			if (this.btn === "left") {
		// 				this.inputLine();
		// 			} else if (this.btn === "right") {
		// 				if (this.mousestart && this.inputpeke_ifborder()) {
		// 					return;
		// 				}
		// 				if (!this.firstCell.isnull || this.notInputted()) {
		// 					this.inputcell();
		// 				}
		// 			}
		// 		} else if (this.mouseend && this.notInputted()) {
		// 			var cell = this.getcell();
		// 			if (!this.firstCell.isnull && cell !== this.firstCell) {
		// 				return;
		// 			}
		// 			if (!cell.isnull && cell.isNum() && this.pid !== "heyajiri") {
		// 				this.inputqcmp();
		// 			} else {
		// 				this.inputcell();
		// 			}
		// 		}
		// 	} else if (this.puzzle.editmode) {
		// 		if (this.pid === "koburin" || this.pid === "retsurin") {
		// 			if (this.mousestart) {
		// 				this.inputqnum();
		// 			}
		// 		} else if (this.mousestart || this.mousemove) {
		// 			if (this.pid === "yajilin" || this.pid === "lixloop") {
		// 				this.inputdirec();
		// 			} else if (this.pid === "heyajiri") {
		// 				this.inputborder();
		// 			}
		// 		} else if (this.mouseend && this.notInputted()) {
		// 			this.inputqnum();
		// 		}
		// 	}
		// },
		inputModes: {
			edit: ["border", "clear", "info-line"],
			play: ["line", "peke", "shade", "unshade", "info-line"]
		},
		mouseinput_auto: function () {
			if (this.puzzle.playmode) {

			} else if (this.puzzle.editmode) {
				if (this.mousestart || this.mousemove) { // ドラッグしたとき
					if (this.isBorderMode()) {
						this.inputborder();   // 境界のそばなら境界線
					} else {
						this.inputdirec();    // 真ん中なら矢印（UI的に書きづらいけど）
					}
				} else if (this.mouseend && this.notInputted()) { // 単にクリックしたとき
					this.inputqnum_heyajilimisaki();
				}
			}
		},


		inputdirec: function () {
			var pos = this.getpos(0);
			if (this.prevPos.equals(pos)) {
				return;
			}

			var cell = this.prevPos.getc();
			if (!cell.isnull) {
				if (cell.qnum !== -1 || cell.qnum2 !== -1) {
					if (cell.qnum2 !== -1) {
						if (cell.qnum2 === -2) {
							cell.setQnum(0);
						} else {
							cell.setQnum(cell.qnum2);
						}
						cell.setQnum2(-1);
					}
					var dir = this.prevPos.getdir(pos, 2);
					if (dir !== cell.NDIR) {
						cell.setQdir(cell.qdir !== dir ? dir : 0);

						if (cell.qdir === 0) {
							if (cell.qnum === 0) {
								cell.setQnum2(-2);
							} else {
								cell.setQnum2(cell.qnum);
							}
							cell.setQnum(-1);
						}

						cell.draw();
					}
				}
			}
			this.prevPos = pos;
		},

		inputqnum_heyajilimisaki: function () {
			var cell = this.getcell();
			if (cell.isnull || cell === this.mouseCell) {
				return;
			}

			if (cell !== this.cursor.getc()) {
				this.setcursor(cell);
			} else {
				this.inputnumber_heyajilimisaki(cell);
			}
			this.mouseCell = cell;
		},

		inputnumber_heyajilimisaki: function (cell) {
			console.log(cell.qnum, cell.qnum2, cell.qnum3, " -> ");

			var max = cell.getmaxnum(),
				num,
				type,
				val = -1;

			if (this.isBorderMode()) {
				type = 3;
			} else {
				if (cell.qnum === -1 && cell.qnum2 === -1) {
					type = 2;
				}
				if (cell.qnum !== -1) {
					type = 1;
				} else {
					type = 2;
				}
			}

			switch (type) {
				case 1:
					num = cell.qnum;
					break;
				case 2:
					num = cell.qnum2;
					break;
				case 3:
					num = cell.qnum3;
					break;
				default:
					num = -1;
					break;
			}

			if (type === 2) {
				if (this.btn === "left") {
					if (num === max) {
						val = -1;
					} else if (num === -1) {
						val = -2;
					} else if (num === -2) {
						val = 1;
					} else {
						val = num + 1;
					}
				} else if (this.btn === "right") {
					if (num === -1) {
						val = max;
					} else if (num === -2) {
						val = -1;
					} else if (num === 1) {
						val = -2;
					} else {
						val = num - 1;
					}
				}
			} else {
				if (this.btn === "left") {
					if (num === max) {
						val = -1;
					} else if (num === -2) {
						val = 0;
					} else {
						val = num + 1;
					}
				} else if (this.btn === "right") {
					if (num === -1) {
						val = max;
					} else if (num === -2) {
						val = max;
					} else {
						val = num - 1;
					}
				}
			}

			switch (type) {
				case 1:
					cell.setQnum(val);
					break;
				case 2:
					cell.setQnum2(val);
					break;
				case 3:
					cell.setdata("qnum3", val);
					break;
				default:
					num = -1;
					break;
			}


			console.log(cell.qnum, cell.qnum2, cell.qnum3);
			cell.draw();
		}

	},


	//---------------------------------------------------------
	// キーボード入力系
	KeyEvent: {
		enablemake: true,
		moveTarget: function (ca) {
			if (ca.match(/shift/)) {
				return false;
			}
			return this.moveTCell(ca);
		},

		keyinput: function (ca) {
			if (this.key_inputdirec(ca)) {
				return;
			}
			this.key_inputqnum(ca);
		}
	},

	//---------------------------------------------------------
	// 盤面管理系
	Cell: {
		// don't draw  dots under lines
		// isDot: function () {
		// 	return this.lcnt === 0 && (this.qsub === 1 || this.qsubBySolver === 1);
		// },
		//
		// countShade: function (clist) {
		// 	if (!clist) {
		// 		return -1;
		// 	}
		// 	return clist.filter(function (cell) {
		// 		return cell.isShade();
		// 	}).length;
		// },
		// hasUndecided: function (clist) {
		// 	if (!clist) {
		// 		return false;
		// 	}
		// 	return clist.some(function (cell) {
		// 		if (cell.qans !== 0) {
		// 			return false;
		// 		}
		// 		if (cell.knowEmpty()) {
		// 			return false;
		// 		}
		// 		return true;
		// 	});
		// },

		// trigger redraw for autocompletion
		// posthook: {
		// 	qsub: function () {
		// 		var cells = [this];
		// 		this.board.redrawAffected(cells);
		// 	},
		// 	qans: function () {
		// 		var cells = [this];
		// 		var adc = this.adjacent;
		// 		var cs = [adc.top, adc.bottom, adc.left, adc.right];
		// 		for (var i = 0; i < cs.length; i++) {
		// 			var c = cs[i];
		// 			if (!c.isnull && c.qans === 0 && c.qsub === 0) {
		// 				cells.push(c);
		// 			}
		// 		}
		// 		this.board.redrawAffected(cells);
		// 	}
		// },

		minnum: 0,
		maxnum: function () {
			return this.room.clist.length;
		},

		// noLP: function (dir) {
		// 	return this.isShade();
		// },
		//
		// allowShade: function () {
		// 	return this.lcnt === 0;
		// },
		// allowUnshade: function () {
		// 	return this.lcnt === 0;
		// },
		//
		// knowEmpty: function () {
		// 	if (this.qsub !== 0) {
		// 		return true;
		// 	}
		// 	if (this.lcnt > 0) {
		// 		return true;
		// 	}
		// 	var shadedNbrs = this.countDir4Cell(function (cell) {
		// 		return cell.isShade() > 0;
		// 	});
		// 	return shadedNbrs > 0;
		// },
		// isCmp: function () {
		// 	if (!this.puzzle.execConfig("autocmp")) {
		// 		return false;
		// 	}
		// 	var clist = this.room.clist;
		// 	if (this.hasUndecided(clist)) {
		// 		return false;
		// 	}
		// 	return this.qnum === this.countShade(clist);
		// }
	},

	Border: {
		enableLineNG: true,
		// posthook: {
		// 	line: function () {
		// 		this.board.scanResult = null;
		// 		var cells = [];
		// 		for (var i = 0; i < this.sidecell.length; i++) {
		// 			cells.push(this.sidecell[i]);
		// 		}
		// 		this.board.redrawAffected(cells);
		// 	}
		// }
	},

	Board: {
		hasborder: 1,

		// scanInside: function () {
		// 	if (this.scanResult !== null) {
		// 		return this.scanResult;
		// 	}
		//
		// 	if (
		// 		this.cell.some(function (cell) {
		// 			return cell.lcnt !== 0 && cell.lcnt !== 2;
		// 		})
		// 	) {
		// 		this.scanResult = false;
		// 		return false;
		// 	}
		//
		// 	for (var y = 2; y < this.maxby; y += 2) {
		// 		var inside = false;
		// 		for (var x = 1; x < this.maxbx; x += 2) {
		// 			if (this.getb(x, y).isLine()) {
		// 				inside ^= true;
		// 			}
		// 			this.getx(x + 1, y).inside = inside;
		// 		}
		// 	}
		//
		// 	this.scanResult = true;
		// 	return true;
		// },
		// rebuildInfo: function () {
		// 	this.scanResult = null;
		// 	this.common.rebuildInfo.call(this);
		// },
		//
		//
		// redrawAffected: function (cells) {
		// 	var done = [];
		// 	for (var i = 0; i < cells.length; i++) {
		// 		var top = cells[i].room.top;
		// 		if (done[top.id]) {
		// 			continue;
		// 		}
		// 		done[top.id] = true;
		// 		top.draw();
		// 	}
		// }
	},

	AreaRoomGraph: {
		enabled: true,
		hastop: true,
		
		
	},
	LineGraph: {
		enabled: true
	},

	//---------------------------------------------------------
	// 画像表示系
	Graphic: {
		hideHatena: true,
		qcmpcolor: "rgb(127,127,127)",

		irowake: true,

		getQuesNumberColor: function (cell) {
			var qnum_color = this.getQuesNumberColor_mixed(cell);
			if ((cell.error || cell.qinfo) === 1) {
				return qnum_color;
			}
			return qnum_color;
			//return cell.isCmp() ? this.qcmpcolor : qnum_color;
		},

		drawQuesNumbers2: function () {
			this.drawCircles();

			this.vinc("cell_number_2", "auto");
			this.drawNumbers_com(
				this.getQuesNumberText2,
				this.getQuesNumberColor,
				"cell_text_2_",
				{ratio: 0.65}
			);
		},

		getQuesNumberText2: function (cell) {
			return this.getNumberText(
				cell,
				(this.puzzle.execConfig("dispmove") ? cell.base : cell).qnum2
			);
		},
		

		getCircleFillColor_qnum: function (cell) {
			if (cell.qnum2 !== -1) {
				var error = cell.error || cell.qinfo;
				if (error === 1 || error === 4) {
					return this.errbcolor1;
				} else {
					return this.circlebasecolor;
				}
			}
			return null;
		},
		getCircleStrokeColor_qnum: function (cell) {
			var puzzle = this.puzzle,
				error = cell.error || cell.qinfo;
			var isdrawmove = puzzle.execConfig("dispmove");
			var num = (!isdrawmove ? cell : cell.base).qnum2;
			if (num !== -1) {
				if (isdrawmove && puzzle.mouse.mouseCell === cell) {
					return this.movecolor;
				} else if (error === 1 || error === 4) {
					return this.errcolor1;
				} else {
					return this.quescolor;
				}
			}
			return null;
		},


		drawFillingNumBase: function() {
			var g = this.vinc("cell_filling_back", "crispEdges", true);
			var isdrawmove = this.puzzle.execConfig("dispmove");
			var clist = this.range.cells;
			for (var i = 0; i < clist.length; i++) {
				var cell = clist[i],
					color = "rgba(237,237,237,0.5)";
				g.vid = "c_full_nb_" + cell.id;
				if (
					!!color &&
					cell.qnum3 !== -1 &&
					
					(cell.qnum !== -1 || cell.qnum2 !== -1)
				) {
					var rx = (cell.bx - 0.9) * this.bw - 0.5,
						ry = (cell.by - 0.9) * this.bh - 0.5;
					g.fillStyle = color;
					g.fillRect(rx, ry, this.bw * 0.8, this.bh * 0.8);
				} else {
					g.vhide();
				}
			}
		},	
		drawFillingNumbers: function() {
			var g = this.vinc("cell_filling_number", "auto");
			var isdrawmove = this.puzzle.execConfig("dispmove");
			var clist = this.range.cells;
			for (var i = 0; i < clist.length; i++) {
				var cell = clist[i],
					num = cell.qnum3,
					px = cell.bx * this.bw,
					py = cell.by * this.bh;
				g.vid = "cell_fill_text_" + cell.id;
				if (num !== -1) {
					var text = num > 0 ? "" + num : "?";
					var option = { position: this.TOPLEFT };
					if ((cell.qnum !== -1 || cell.qnum2 !== -1)) {
						option.ratio = 0.4;
						option.width = [0.5, 0.33];
					} else {
						option.hoffset = 0.8;
						option.voffset = 0.75;
						option.ratio = 0.5;
					}
					g.fillStyle = this.getQuesNumberColor(cell);
					this.disptext(text, px, py, option);
				} else {
					g.vhide();
				}
			}
		},//{ratio: 0.4, position: 5, hoffset: 0.8, voffset: 0.75}

		paint: function () {
			this.drawBGCells();
			this.drawShadedCells();
			this.drawDotCells();
			this.drawGrid();

			this.drawBorders();
			this.drawLines();

			this.drawArrowNumbers();
			this.drawQuesNumbers2();
			this.drawFillingNumBase();
			this.drawFillingNumbers();
			
			this.drawPekes();
			this.drawChassis();
			this.drawBoxBorders(false);
			this.drawTarget();
			
		}

	},

	//---------------------------------------------------------
	// URLエンコード/デコード処理

	Encode: {},

	//---------------------------------------------------------

	FileIO: {},

	//---------------------------------------------------------
	// 正解判定処理実行部
	AnsCheck: {},
});
