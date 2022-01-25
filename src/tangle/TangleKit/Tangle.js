//
//  Tangle.js
//  Tangle 0.1.0
//
//  Created by Bret Victor on 5/2/10.
//  (c) 2011 Bret Victor.  MIT open-source license.
//
//  ------ model ------
//
//  var tangle = new Tangle(rootElement, model);
//  tangle.setModel(model);
//
//  ------ variables ------
//
//  var value = tangle.getValue(variableName);
//  tangle.setValue(variableName, value);
//  tangle.setValues({ variableName:value, variableName:value });
//
//  ------ UI components ------
//
//  Tangle.classes.myClass = {
//     initialize: function (element, options, tangle, variable) { ... },
//     update: function (element, value) { ... }
//  };
//  Tangle.formats.myFormat = function (value) { return "..."; };
//

const BVTouchable = require('./BVTouchable');
require('sprintf-js');
const { removeClass, addClass, setStyles } = require('./shim');

var Tangle = this.Tangle = function (rootElement, modelClass) {

    var tangle = this;
    tangle.element = rootElement;
    tangle.setModel = setModel;
    tangle.getValue = getValue;
    tangle.setValue = setValue;
    tangle.setValues = setValues;

    var _model;
    var _nextSetterID = 0;
    var _setterInfosByVariableName = {};   //  { varName: { setterID:7, setter:function (v) { } }, ... }
    var _varargConstructorsByArgCount = [];


    //----------------------------------------------------------
    //
    // construct

    initializeElements();
    setModel(modelClass);
    return tangle;


    //----------------------------------------------------------
    //
    // elements

    function initializeElements() {
        var elements = rootElement.getElementsByTagName("*");
        var interestingElements = [];
        
        // build a list of elements with class or data-var attributes
        
        for (var i = 0, length = elements.length; i < length; i++) {
            var element = elements[i];
            if (element.getAttribute("class") || element.getAttribute("data-var")) {
                interestingElements.push(element);
            }
        }

        // initialize interesting elements in this list.  (Can't traverse "elements"
        // directly, because elements is "live", and views that change the node tree
        // will change elements mid-traversal.)
        
        for (var i = 0, length = interestingElements.length; i < length; i++) {
            var element = interestingElements[i];
            
            var varNames = null;
            var varAttribute = element.getAttribute("data-var");
            if (varAttribute) { varNames = varAttribute.split(" "); }

            var views = null;
            var classAttribute = element.getAttribute("class");
            if (classAttribute) {
                var classNames = classAttribute.split(" ");
                views = getViewsForElement(element, classNames, varNames);
            }
            
            if (!varNames) { continue; }
            
            var didAddSetter = false;
            if (views) {
                for (var j = 0; j < views.length; j++) {
                    if (!views[j].update) { continue; }
                    addViewSettersForElement(element, varNames, views[j]);
                    didAddSetter = true;
                }
            }
            
            if (!didAddSetter) {
                var formatAttribute = element.getAttribute("data-format");
                var formatter = getFormatterForFormat(formatAttribute, varNames);
                addFormatSettersForElement(element, varNames, formatter);
            }
        }
    }
            
    function getViewsForElement(element, classNames, varNames) {   // initialize classes
        var views = null;
        
        for (var i = 0, length = classNames.length; i < length; i++) {
            var clas = Tangle.classes[classNames[i]];
            if (!clas) { continue; }
            
            var options = getOptionsForElement(element);
            var args = [ element, options, tangle ];
            if (varNames) { args = args.concat(varNames); }
            
            var view = constructClass(clas, args);
            
            if (!views) { views = []; }
            views.push(view);
        }
        
        return views;
    }
    
    function getOptionsForElement(element) {   // might use dataset someday
        var options = {};

        var attributes = element.attributes;
        var regexp = /^data-[\w\-]+$/;

        for (var i = 0, length = attributes.length; i < length; i++) {
            var attr = attributes[i];
            var attrName = attr.name;
            if (!attrName || !regexp.test(attrName)) { continue; }
            
            options[attrName.substr(5)] = attr.value;
        }
         
        return options;   
    }
    
    function constructClass(clas, args) {
        if (typeof clas !== "function") {  // class is prototype object
            var View = function () { };
            View.prototype = clas;
            var view = new View();
            if (view.initialize) { view.initialize.apply(view,args); }
            return view;
        }
        else {  // class is constructor function, which we need to "new" with varargs (but no built-in way to do so)
            var ctor = _varargConstructorsByArgCount[args.length];
            if (!ctor) {
                var ctorArgs = [];
                for (var i = 0; i < args.length; i++) { ctorArgs.push("args[" + i + "]"); }
                var ctorString = "(function (clas,args) { return new clas(" + ctorArgs.join(",") + "); })";
                ctor = eval(ctorString);   // nasty
                _varargConstructorsByArgCount[args.length] = ctor;   // but cached
            }
            return ctor(clas,args);
        }
    }
    

    //----------------------------------------------------------
    //
    // formatters

    function getFormatterForFormat(formatAttribute, varNames) {
        if (!formatAttribute) { formatAttribute = "default"; }

        var formatter = getFormatterForCustomFormat(formatAttribute, varNames);
        if (!formatter) { formatter = getFormatterForSprintfFormat(formatAttribute, varNames); }
        if (!formatter) { log("Tangle: unknown format: " + formatAttribute); formatter = getFormatterForFormat(null,varNames); }

        return formatter;
    }
        
    function getFormatterForCustomFormat(formatAttribute, varNames) {
        var components = formatAttribute.split(" ");
        var formatName = components[0];
        if (!formatName) { return null; }
        
        var format = Tangle.formats[formatName];
        if (!format) { return null; }
        
        var formatter;
        var params = components.slice(1);
        
        if (varNames.length <= 1 && params.length === 0) {  // one variable, no params
            formatter = format;
        }
        else if (varNames.length <= 1) {  // one variable with params
            formatter = function (value) {
                var args = [ value ].concat(params);
                return format.apply(null, args);
            };
        }
        else {  // multiple variables
            formatter = function () {
                var values = getValuesForVariables(varNames);
                var args = values.concat(params);
                return format.apply(null, args);
            };
        }
        return formatter;
    }
    
    function getFormatterForSprintfFormat(formatAttribute, varNames) {
        if (!sprintf || !formatAttribute.test(/\%/)) { return null; }

        var formatter;
        if (varNames.length <= 1) {  // one variable
            formatter = function (value) {
                return sprintf(formatAttribute, value);
            };
        }
        else {
            formatter = function (value) {  // multiple variables
                var values = getValuesForVariables(varNames);
                var args = [ formatAttribute ].concat(values);
                return sprintf.apply(null, args);
            };
        }
        return formatter;
    }

    
    //----------------------------------------------------------
    //
    // setters
    
    function addViewSettersForElement(element, varNames, view) {   // element has a class with an update method
        var setter;
        if (varNames.length <= 1) {
            setter = function (value) { view.update(element, value); };
        }
        else {
            setter = function () {
                var values = getValuesForVariables(varNames);
                var args = [ element ].concat(values);
                view.update.apply(view,args);
            };
        }

        addSetterForVariables(setter, varNames);
    }

    function addFormatSettersForElement(element, varNames, formatter) {  // tangle is injecting a formatted value itself
        var span = null;
        var setter = function (value) {
            if (!span) { 
                span = document.createElement("span");
                element.insertBefore(span, element.firstChild);
            }
            span.innerHTML = formatter(value);
        };

        addSetterForVariables(setter, varNames);
    }
    
    function addSetterForVariables(setter, varNames) {
        var setterInfo = { setterID:_nextSetterID, setter:setter };
        _nextSetterID++;

        for (var i = 0; i < varNames.length; i++) {
            var varName = varNames[i];
            if (!_setterInfosByVariableName[varName]) { _setterInfosByVariableName[varName] = []; }
            _setterInfosByVariableName[varName].push(setterInfo);
        }
    }

    function applySettersForVariables(varNames) {
        var appliedSetterIDs = {};  // remember setterIDs that we've applied, so we don't call setters twice
    
        for (var i = 0, ilength = varNames.length; i < ilength; i++) {
            var varName = varNames[i];
            var setterInfos = _setterInfosByVariableName[varName];
            if (!setterInfos) { continue; }
            
            var value = _model[varName];
            
            for (var j = 0, jlength = setterInfos.length; j < jlength; j++) {
                var setterInfo = setterInfos[j];
                if (setterInfo.setterID in appliedSetterIDs) { continue; }  // if we've already applied this setter, move on
                appliedSetterIDs[setterInfo.setterID] = true;
                
                setterInfo.setter(value);
            }
        }
    }
    

    //----------------------------------------------------------
    //
    // variables

    function getValue(varName) {
        var value = _model[varName];
        if (value === undefined) { log("Tangle: unknown variable: " + varName);  return 0; }
        return value;
    }

    function setValue(varName, value) {
        var obj = {};
        obj[varName] = value;
        setValues(obj);
    }

    function setValues(obj) {
        var changedVarNames = [];

        for (var varName in obj) {
            var value = obj[varName];
            var oldValue = _model[varName];
            if (oldValue === undefined) { log("Tangle: setting unknown variable: " + varName);  continue; }
            if (oldValue === value) { continue; }  // don't update if new value is the same

            _model[varName] = value;
            changedVarNames.push(varName);
        }
        
        if (changedVarNames.length) {
            applySettersForVariables(changedVarNames);
            updateModel();
        }
    }
    
    function getValuesForVariables(varNames) {
        var values = [];
        for (var i = 0, length = varNames.length; i < length; i++) {
            values.push(getValue(varNames[i]));
        }
        return values;
    }

                    
    //----------------------------------------------------------
    //
    // model

    function setModel(modelClass) {
        var ModelClass = function () { };
        ModelClass.prototype = modelClass;
        _model = new ModelClass;

        updateModel(true);  // initialize and update
    }
    
    function updateModel(shouldInitialize) {
        var ShadowModel = function () {};  // make a shadow object, so we can see exactly which properties changed
        ShadowModel.prototype = _model;
        var shadowModel = new ShadowModel;
        
        if (shouldInitialize) { shadowModel.initialize(); }
        shadowModel.update();
        
        var changedVarNames = [];
        for (var varName in shadowModel) {
            if (!shadowModel.hasOwnProperty(varName)) { continue; }
            if (_model[varName] === shadowModel[varName]) { continue; }
            
            _model[varName] = shadowModel[varName];
            changedVarNames.push(varName);
        }
        
        applySettersForVariables(changedVarNames);
    }


    //----------------------------------------------------------
    //
    // debug

    function log (msg) {
        if (window.console) { window.console.log(msg); }
    }

};  // end of Tangle




//----------------------------------------------------------
//
// components

Tangle.classes = {};
Tangle.formats = {};

Tangle.formats["default"] = function (value) { return "" + value; };


//----------------------------------------------------------
//
// TangleKit

Tangle.classes.TKIf = {
    
    initialize: function (element, options, tangle, variable) {
        this.isInverted = !!options.invert;
    },
    
    update: function (element, value) {
        if (this.isInverted) { value = !value; }
        if (value) { element.style.removeProperty("display"); } 
        else { element.style.display = "none" };
    }
};


//----------------------------------------------------------
//
//  TKSwitch
//
//  Shows the element's nth child if value is n.
//
//  False or true values will show the first or second child respectively.

Tangle.classes.TKSwitch = {

    update: function (element, value) {
        element.getChildren().each( function (child, index) {
            if (index != value) { child.style.display = "none"; } 
            else { child.style.removeProperty("display"); }
        });
    }
};


//----------------------------------------------------------
//
//  TKSwitchPositiveNegative
//
//  Shows the element's first child if value is positive or zero.
//  Shows the element's second child if value is negative.

Tangle.classes.TKSwitchPositiveNegative = {

    update: function (element, value) {
        Tangle.classes.TKSwitch.update(element, value < 0);
    }
};


//----------------------------------------------------------
//
//  TKToggle
//
//  Click to toggle value between 0 and 1.

Tangle.classes.TKToggle = {

    initialize: function (element, options, tangle, variable) {
        element.addEventListener("click", function (event) {
            var isActive = tangle.getValue(variable);
            tangle.setValue(variable, isActive ? 0 : 1);
        });
    }
};


//----------------------------------------------------------
//
//  TKNumberField
//
//  An input box where a number can be typed in.
//
//  Attributes:  data-size (optional): width of the box in characters

Tangle.classes.TKNumberField = {

    initialize: function (element, options, tangle, variable) {
        this.input = document.createElement("input");
        this.input.className = "TKNumberFieldInput";
        this.input.type = "text";
        this.input.size = options.size || 6;
        this.input.children = [element, ...this.input.children];
        // this.input = new Element("input", {
        //     type: "text",
        //     "class":"TKNumberFieldInput",
        //     size: options.size || 6
        // }).inject(element, "top");
        
        var inputChanged = (function () {
            var value = this.getValue();
            tangle.setValue(variable, value);
        }).bind(this);
        
        this.input.addEventListener("keyup",  inputChanged);
        this.input.addEventListener("blur",   inputChanged);
        this.input.addEventListener("change", inputChanged);
    },
    
    getValue: function () {
        var value = Number.parseFloat(this.input.value);
        // var value = parseFloat(this.input.get("value"));
        return isNaN(value) ? 0 : value;
    },
    
    update: function (element, value) {
        var currentValue = this.getValue();
        if (value !== currentValue) { this.input.set("value", "" + value); }
    }
};


//----------------------------------------------------------
//
//  TKAdjustableNumber
//
//  Drag a number to adjust.
//
//  Attributes:  data-min (optional): minimum value
//               data-max (optional): maximum value
//               data-step (optional): granularity of adjustment (can be fractional)

var isAnyAdjustableNumberDragging = false;  // hack for dragging one value over another one

Tangle.classes.TKAdjustableNumber = {

    initialize: function (element, options, tangle, variable) {
        this.element = element;
        this.tangle = tangle;
        this.variable = variable;

        this.min = (options.min !== undefined) ? parseFloat(options.min) : 0;
        this.max = (options.max !== undefined) ? parseFloat(options.max) : 1e100;
        this.step = (options.step !== undefined) ? parseFloat(options.step) : 1;
        
        this.initializeHover();
        this.initializeHelp();
        this.initializeDrag();
    },


    // hover
    
    initializeHover: function () {
        this.isHovering = false;
        this.element.addEventListener("mouseenter", (function () { this.isHovering = true;  this.updateRolloverEffects(); }).bind(this));
        this.element.addEventListener("mouseleave", (function () { this.isHovering = false; this.updateRolloverEffects(); }).bind(this));
    },
    
    updateRolloverEffects: function () {
        this.updateStyle();
        this.updateCursor();
        this.updateHelp();
    },
    
    isActive: function () {
        return this.isDragging || (this.isHovering && !isAnyAdjustableNumberDragging);
    },

    updateStyle: function () {
        if (this.isDragging) { addClass("TKAdjustableNumberDown")(this.element); }
        else {
            removeClass("TKAdjustableNumberDown")(this.element);
        }
        
        if (!this.isDragging && this.isActive()) { addClass("TKAdjustableNumberHover")(this.element); }
        else {
            removeClass("TKAdjustableNumberHover")(this.element);
        }
    },

    updateCursor: function () {
        var body = document.body;
        if (this.isActive()) { addClass("TKCursorDragHorizontal")(body); }
        else {
            removeClass("TKCursorDragHorizontal")(body);
        }
    },


    // help

    initializeHelp: function () {
        this.helpElement = document.createElement("div");
        this.helpElement.className = "TKAdjustableNumberHelp";
        this.helpElement.innerHTML = "drag";
        setStyles({display: "none"})(this.helpElement);
        this.element.prepend(this.helpElement);
        // this.helpElement = (new Element("div", { "class": "TKAdjustableNumberHelp" })).inject(this.element, "top");
        // this.helpElement.setStyle("display", "none");
        // this.helpElement.set("text", "drag");
    },
    
    updateHelp: function () {
        var rect = this.element.getBoundingClientRect();
        var size = {x: rect.width, y: rect.height};
        var top = -size.y + 7;
        var left = Math.round(0.5 * (size.x - 20));
        var display = (this.isHovering && !isAnyAdjustableNumberDragging) ? "block" : "none";
        // this.helpElement.style = this.helpElement.style + `left:${left}; top:${top}; display:${display};`;
        setStyles({ left:`${left}px`, top:`${top}px`, display:display })(this.helpElement);
        // this.helpElement.setStyles({ left:left, top:top, display:display });
    },


    // drag
    
    initializeDrag: function () {
        this.isDragging = false;
        new BVTouchable(this.element, this);
    },
    
    touchDidGoDown: function (touches) {
        this.valueAtMouseDown = this.tangle.getValue(this.variable);
        this.isDragging = true;
        isAnyAdjustableNumberDragging = true;
        this.updateRolloverEffects();
        this.updateStyle();
    },
    
    touchDidMove: function (touches) {
        var value = this.valueAtMouseDown + touches.translation.x / 5 * this.step;
        value = ((value / this.step).round() * this.step).limit(this.min, this.max);
        this.tangle.setValue(this.variable, value);
        this.updateHelp();
    },
    
    touchDidGoUp: function (touches) {
        this.isDragging = false;
        isAnyAdjustableNumberDragging = false;
        this.updateRolloverEffects();
        this.updateStyle();
        setStyles({display: touches.wasTap ? "block" : "none"})(this.helpElement);
        // this.helpElement.setStyle("display", touches.wasTap ? "block" : "none");
    }
};


//----------------------------------------------------------
//
//  TKLogAdjustableNumber
//
//  Drag a number to adjust.
//
//  Attributes:  data-min (optional): minimum value
//               data-max (optional): maximum value
//               data-step (optional): granularity of adjustment (can be fractional)

var isAnyAdjustableNumberDragging = false;  // hack for dragging one value over another one

Tangle.classes.TKLogAdjustableNumber = {

    initialize: function (element, options, tangle, variable) {
        this.element = element;
        this.tangle = tangle;
        this.variable = variable;

        this.min = (options.min !== undefined) ? parseFloat(options.min) : 1;
        this.max = (options.max !== undefined) ? parseFloat(options.max) : 1e100;
        this.step = (options.step !== undefined) ? parseFloat(options.step) : 0.02;
        
        this.initializeHover();
        this.initializeHelp();
        this.initializeDrag();
    },


    // hover
    
    initializeHover: function () {
        this.isHovering = false;
        this.element.addEventListener("mouseenter", (function () { this.isHovering = true;  this.updateRolloverEffects(); }).bind(this));
        this.element.addEventListener("mouseleave", (function () { this.isHovering = false; this.updateRolloverEffects(); }).bind(this));
    },
    
    updateRolloverEffects: function () {
        this.updateStyle();
        this.updateCursor();
        this.updateHelp();
    },
    
    isActive: function () {
        return this.isDragging || (this.isHovering && !isAnyAdjustableNumberDragging);
    },

    updateStyle: function () {
        if (this.isDragging) { addClass("TKAdjustableNumberDown")(this.element); }
        else {
            removeClass("TKAdjustableNumberDown")(this.element);
        }
        
        if (!this.isDragging && this.isActive()) { addClass("TKAdjustableNumberHover")(this.element); }
        else {
            removeClass("TKAdjustableNumberHover")(this.element);
        }
    },

    updateCursor: function () {
        var body = document.body;
        if (this.isActive()) { addClass("TKCursorDragHorizontal")(body); }
        else {
            removeClass("TKCursorDragHorizontal")(body);
        }
    },


    // help

    initializeHelp: function () {
        this.helpElement = document.createElement("div");
        this.helpElement.className = "TKAdjustableNumberHelp";
        this.helpElement.innerHTML = "drag";
        setStyles({display: "none"})(this.helpElement);
        this.element.prepend(this.helpElement);
        // this.helpElement = (new Element("div", { "class": "TKAdjustableNumberHelp" })).inject(this.element, "top");
        // this.helpElement.setStyle("display", "none");
        // this.helpElement.set("text", "drag");
    },
    
    updateHelp: function () {
        var rect = this.element.getBoundingClientRect();
        var size = {x: rect.width, y: rect.height};
        var top = -size.y + 7;
        var left = Math.round(0.5 * (size.x - 20));
        var display = (this.isHovering && !isAnyAdjustableNumberDragging) ? "block" : "none";
        // this.helpElement.style = this.helpElement.style + `left:${left}; top:${top}; display:${display};`;
        setStyles({ left:`${left}px`, top:`${top}px`, display:display })(this.helpElement);
        // this.helpElement.setStyles({ left:left, top:top, display:display });
    },


    // drag
    
    initializeDrag: function () {
        this.isDragging = false;
        new BVTouchable(this.element, this);
    },
    
    touchDidGoDown: function (touches) {
        this.valueAtMouseDown = this.tangle.getValue(this.variable);
        this.isDragging = true;
        isAnyAdjustableNumberDragging = true;
        this.updateRolloverEffects();
        this.updateStyle();
    },
    
    touchDidMove: function (touches) {
        var logValue = Math.log10(this.valueAtMouseDown) + touches.translation.x / 5 * this.step;
        logValue = (logValue / this.step).round() * this.step;
        var value = Math.pow(10, logValue);
        value = (value).limit(this.min, this.max);
        this.tangle.setValue(this.variable, value);
        this.updateHelp();
    },
    
    touchDidGoUp: function (touches) {
        this.isDragging = false;
        isAnyAdjustableNumberDragging = false;
        this.updateRolloverEffects();
        this.updateStyle();
        setStyles({display: touches.wasTap ? "block" : "none"})(this.helpElement);
        // this.helpElement.setStyle("display", touches.wasTap ? "block" : "none");
    }
};



//----------------------------------------------------------
//
//  formats
//
//  Most of these are left over from older versions of Tangle,
//  before parameters and printf were available.  They should
//  be redesigned.
//

function formatValueWithPrecision (value,precision) {
    if (Math.abs(value) >= 100) { precision--; }
    if (Math.abs(value) >= 10) { precision--; }
    return "" + value.round(Math.max(precision,0));
}

Tangle.formats.p3 = function (value) {
    return formatValueWithPrecision(value,3);
};

Tangle.formats.neg_p3 = function (value) {
    return formatValueWithPrecision(-value,3);
};

Tangle.formats.p2 = function (value) {
    return formatValueWithPrecision(value,2);
};

Tangle.formats.e6 = function (value) {
    return "" + (value * 1e-6).round();
};

Tangle.formats.abs_e6 = function (value) {
    return "" + (Math.abs(value) * 1e-6).round();
};

Tangle.formats.freq = function (value) {
    if (value < 100) { return "" + value.round(1) + " Hz"; }
    if (value < 1000) { return "" + value.round(0) + " Hz"; }
    return "" + (value / 1000).round(2) + " KHz"; 
};

Tangle.formats.dollars = function (value) {
    var numPart = value.round(0);
    numPart = String(numPart).split("").reverse().reduce((a,v,i)=>(i&&(i%3===0))?v+','+a:v+a,"");
    return "$" + numPart;
};

Tangle.formats.free = function (value) {
    return value ? ("$" + value.round(0)) : "free";
};

Tangle.formats.percent = function (value) {
    return "" + (100 * value).round(0) + "%";
};

module.exports = Tangle