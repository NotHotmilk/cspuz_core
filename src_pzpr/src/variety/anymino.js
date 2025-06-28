//
// パズル固有スクリプト部 ＬＩＴＳ・のりのり版 lits.js
//
(function (pidlist, classbase) {
	if (typeof module === "object" && module.exports) {
		module.exports = [pidlist, classbase];
	} else {
		pzpr.classmgr.makeCustom(pidlist, classbase);
	}
})(["anymino"], {
	//---------------------------------------------------------
	// マウス入力系
	MouseEvent: {
		use: true,
		mouseinput_auto: function () {
			if (this.puzzle.playmode) {
				if (this.mousestart || this.mousemove) {
					this.inputcell();
				}
			} else if (this.puzzle.editmode) {
				if (this.mousestart || this.mousemove) {
					this.inputborder();
				}
			}
		},
		inputModes: {
			edit: ["border", "info-blk"],
			play: ["shade", "unshade", "info-blk"]
		}
	},

	//---------------------------------------------------------
	// 盤面管理系
	Cell: {},
	Board: {
		hasborder: 1
	},
	AreaShadeGraph: {
		enabled: true
	},
	AreaRoomGraph: {
		enabled: true
	},

	//---------------------------------------------------------
	// 画像表示系
	Graphic: {
		gridcolor_type: "DARK",

		qanscolor: "rgb(96, 96, 96)",
		shadecolor: "rgb(96, 96, 96)",
		qcmpbgcolor: "rgb(96, 255, 160)",
		errbcolor2: "rgb(192, 192, 255)",

		paint: function () {
			this.drawBGCells();
			this.drawShadedCells();
			this.drawDotCells();
			this.drawGrid();

			this.drawBorders();

			this.drawChassis();
		}
	},

	//---------------------------------------------------------
	// URLエンコード/デコード処理
	Encode: {
		decodePzpr: function (type) {
			this.decodeBorder();
		},
		encodePzpr: function (type) {
			this.encodeBorder();
		},

		decodeKanpen: function () {
			this.fio.decodeAreaRoom();
		},
		encodeKanpen: function () {
			this.fio.encodeAreaRoom();
		},
		
	},
	//---------------------------------------------------------
	FileIO: {
		decodeData: function () {
			this.decodeAreaRoom();
			this.decodeCellAns();
		},
		encodeData: function () {
			this.encodeAreaRoom();
			this.encodeCellAns();
		},

		kanpenOpen: function () {
			this.decodeAreaRoom();
			this.decodeCellAns();
		},
		kanpenSave: function () {
			this.encodeAreaRoom();
			this.encodeCellAns();
		},

		kanpenOpenXML: function () {
			this.decodeAreaRoom_XMLBoard();
			this.decodeCellAns_XMLAnswer();
		},
		kanpenSaveXML: function () {
			this.encodeAreaRoom_XMLBoard();
			this.encodeCellAns_XMLAnswer();
		}
	},

	//---------------------------------------------------------
	// 正解判定処理実行部

});
