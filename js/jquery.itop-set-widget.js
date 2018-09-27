/*
 *  Copyright (c) 2010-2018 Combodo SARL
 *
 *    This file is part of iTop.
 *
 *    iTop is free software; you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License as published by
 *    the Free Software Foundation, either version 3 of the License, or
 *    (at your option) any later version.
 *
 *    iTop is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with iTop. If not, see <http://www.gnu.org/licenses/>
 *
 */

/**
 * <p>To be applied on a field containing a JSON value. The value will be updated on every change.<br>
 * Exemple of JSON value :
 * <code>
 * {
 *   "possible_values": [
 *     {
 *       "code": "critical",
 *       "label": "Critical ticket"
 *     },
 *     {
 *       "code": "high",
 *       "label": "don't forget it !"
 *     },
 *     {
 *       "code": "normal",
 *       "label": "when time available"
 *     },
 *     {
 *       "code": "low",
 *       "label": "don't worry ;)"
 *     }
 *   ],
 *   "max_items_allowed": 20,
 *   "partial_values": [],
 *   "orig_value": [
 *     "critical"
 *   ],
 *   "added": [
 *     "normal",
 *     "high",
 *     "low"
 *   ],
 *   "removed": ["critical"]
 * }
 * </code>
 *
 * <p>Needs js/selectize.js already loaded !! (https://github.com/selectize/selectize.js)<br>
 * In the future we could use WebPack... Or a solution like this :
 * https://www.safaribooksonline.com/library/view/learning-javascript-design/9781449334840/ch13s09.html
 */
$.widget('itop.set_widget',
	{
		// default options
		options: {isDebug: false},

		PARENT_CSS_CLASS: "attribute-set",
		ITEM_CSS_CLASS: "attribute-set-item",

		POSSIBLE_VAL_KEY: 'possible_values',
		PARTIAL_VAL_KEY: "partial_values",
		ORIG_VAL_KEY: "orig_value",
		ADDED_VAL_KEY: "added",
		REMOVED_VAL_KEY: "removed",
		STATUS_ADDED: "added",
		STATUS_REMOVED: "removed",
        STATUS_NEUTRAL: "unchanged",
        MAX_ITEMS_ALLOWED_KEY: "max_items_allowed",

		possibleValues: null,
		partialValues: null,
		originalValue: null,
		/** will hold all interactions done : code as key and one of STATUS_* constant as value */
		setItemsCodesStatus: null,

		selectizeWidget: null,
		maxItemsAllowed: null,

		// the constructor
		_create: function () {
			var $this = this.element;

			this._initWidgetData($this.val());
			this._generateSelectionWidget($this);
		},

		// events bound via _bind are removed automatically
		// revert other modifications here
		_destroy: function () {
			this.refresh();
		},


		_initWidgetData: function (originalFieldValue) {
			var dataArray = JSON.parse(originalFieldValue);
			this.possibleValues = dataArray[this.POSSIBLE_VAL_KEY];
			this.partialValues = ($.isArray(dataArray[this.PARTIAL_VAL_KEY])) ? dataArray[this.PARTIAL_VAL_KEY] : [];
			this.originalValue = dataArray[this.ORIG_VAL_KEY];
			this.maxItemsAllowed = dataArray[this.MAX_ITEMS_ALLOWED_KEY];
			this.setItemsCodesStatus = {};
		},

		_generateSelectionWidget: function ($widgetElement) {
			var $parentElement = $widgetElement.parent(),
				inputId = $widgetElement.attr("id") + "-setwidget-values";

			$parentElement.append("<input id='" + inputId + "' value='" + this.originalValue.join(" ") + "'>");
			var $inputWidget = $("#" + inputId);

			// create closure to have both set widget and Selectize instances available in callbacks
			// selectize instance could also be retrieve on the source input DOM node (selectize property)
			// I think this is much clearer this way !
			var setWidget = this;

			$inputWidget.selectize({
				plugins: ['remove_button'],
				delimiter: ' ',
				maxItems: this.maxItemsAllowed,
				hideSelected: true,
				valueField: 'code',
				labelField: 'label',
				searchField: 'label',
				options: this.possibleValues,
				create: false,
				placeholder: Dict.S("Core:AttributeSet:placeholder"),
				onInitialize: function () {
					var selectizeWidget = this;
					setWidget._onInitialize(selectizeWidget);
				},
				onItemAdd: function (value, $item) {
					var selectizeWidget = this;
					setWidget._onTagAdd(value, $item, selectizeWidget);
				},
				onItemRemove: function (value) {
					var selectizeWidget = this;
					setWidget._onTagRemove(value, selectizeWidget);
				}
			});

			this.selectizeWidget = $inputWidget[0].selectize; // keeping this for widget public methods
		},

		refresh: function () {
			if (this.options.isDebug) {
				console.debug("refresh");
			}
			var widgetPublicData = {}, addedValues = [], removedValues = [];

			widgetPublicData[this.POSSIBLE_VAL_KEY] = this.possibleValues;
			widgetPublicData[this.PARTIAL_VAL_KEY] = this.partialValues;
			widgetPublicData[this.ORIG_VAL_KEY] = this.originalValue;

			for (var setItemCode in this.setItemsCodesStatus) {
				var setItemCodeStatus = this.setItemsCodesStatus[setItemCode];
				switch (setItemCodeStatus) {
					case this.STATUS_ADDED:
						addedValues.push(setItemCode);
						break;
					case this.STATUS_REMOVED:
						removedValues.push(setItemCode);
						break;
				}
			}
			widgetPublicData[this.ADDED_VAL_KEY] = addedValues;
			widgetPublicData[this.REMOVED_VAL_KEY] = removedValues;

			this.element.val(JSON.stringify(widgetPublicData, null, (this.options.isDebug ? 2 : null)));
		},

		disable: function () {
			this.selectizeWidget.disable();
		},

		enable: function () {
			this.selectizeWidget.enable();
		},

		/**
         * <p>Updating selection widget :
         * <ul>
         *     <li>adding specific CSS class to parent node
         *     <li>adding specific CSS classes to item node
         *     <li>items to have a specific rendering for partial codes.
         * </ul>
         *
         * <p>For partial codes at first I was thinking about using the Selectize <code>render</code> callback, but it is called before <code>onItemAdd</code>/<code>onItemRemove</code> :(<br>
         * Indeed as we only need to have partial items on first display, this callback is the right place O:)
		 *
         * @param selectionWidget Selectize object
         * @private
         */
		_onInitialize: function (selectionWidget) {
            var setWidget = this;
			if (this.options.isDebug) {
				console.debug("onInit", selectionWidget, setWidget);
			}

			selectionWidget.$control.addClass(setWidget.PARENT_CSS_CLASS);

			selectionWidget.items.forEach(function (setItemCode) {
				var $item = selectionWidget.getItem(setItemCode);
				$item.addClass(setWidget.ITEM_CSS_CLASS);
				$item.addClass(setWidget.ITEM_CSS_CLASS + '-' + setItemCode); // no escape as codes are already pretty restrictive

				if (setWidget._isCodeInPartialValues(setItemCode)) {
					selectionWidget.getItem(setItemCode).addClass("partial-code");
				}
			});
		},

		_onTagAdd: function (setItemCode, $item, inputWidget) {
			if (this.options.isDebug) {
				console.debug("tagAdd");
			}
			this.setItemsCodesStatus[setItemCode] = this.STATUS_ADDED;

			if (this._isCodeInPartialValues(setItemCode)) {
				this.partialValues = this.partialValues.filter(item => (item !== setItemCode));
			} else {
				if (this.originalValue.indexOf(setItemCode) !== -1) {
					// do not add if was present initially and removed
					this.setItemsCodesStatus[setItemCode] = this.STATUS_NEUTRAL;
				}
			}

			this.refresh();
		},

		_onTagRemove: function (setItemCode, inputWidget) {
			this.setItemsCodesStatus[setItemCode] = this.STATUS_REMOVED;

			if (this._isCodeInPartialValues(setItemCode)) {
				// force rendering items again, otherwise partial class will be kept
				// can'be in the onItemAdd callback as it is called after the render callback...
				inputWidget.clearCache("item");
			}

			if (this.originalValue.indexOf(setItemCode) === -1) {
				// do not remove if wasn't present initially
				this.setItemsCodesStatus[setItemCode] = this.STATUS_NEUTRAL;
			}

			this.refresh();
		},

		_isCodeInPartialValues: function (setItemCode) {
			return (this.partialValues.indexOf(setItemCode) >= 0);
		}
	});