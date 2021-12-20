import { LightningElement, api, track } from "lwc";
import CURRENCY from "@salesforce/i18n/currency";
import LOCALE from "@salesforce/i18n/locale";

import { apiService } from "c/service";
import textInput from "./textInput.html";
import textArea from "./textArea.html";
import field from "./field.html";
import dateTime from "./dateTime.html";
import button from "./button.html";
import hidden from "./hidden.html";
import dropdown from "./dropdown.html";
import radiogroup from "./radiogroup.html";
import checkbox from "./checkbox.html";
import link from "./link.html";
import icon from "./icon.html";
import image from "./image.html";
import paragraph from "./paragraph.html";
import attachment from "./attachment.html";
import displayText from "./displayText.html";
import autocomplete from "./autocomplete.html";
import captionField from "./caption.html";

export default class Field extends LightningElement {
  @api fieldObject = {};
  @api hideLabel;
  @api registerComponent;
  @api caseData;
  @api fieldChangedHandler;
  @api fieldClickedHandler;
  @api fieldBluredHandler;
  @api getWorkObject;
  @api url;

  @track dropdownOptions = [];
  @track radioOptions = [];
  searchTerm;
  @track autocompleteOptions = [];
  @track showOptions;
  @track value;
  @track caseAttachments = [];
  @track selectedOption;
  @track isLoading;
  hasRendered;

  standardIcons = {
    pxIconAddItem: "utility:add",
    pxIconAddNewWork: "utility:new",
    pxIconAttachments: "utility:attach",
    pxCancel: "utility:close",
    pxIconDeleteItem: "utility:delete",
    pxIconExpandCollapse: "utility:steps",
    pxIconExplore: "utility:setting",
    pxIconFinishAssignment: "utility:task",
    pxIconHistory: "utility:rows",
    pxIconPrint: "utility:print",
    pxIconReopenWorkItem: "utility:share",
    pxIconReview: "utility:preview",
    pxIconSave: "utility:save",
    pxIconShowFlowLocation: "utility:location",
    pxIconSpellChecker: "utility:utility:check",
    pxIconUpdate: "record_update",
    pxIconShowReopenScreen: "utility:undo",
    "dot-3": "utility:threedots",
    plus: "utility:add",
    minus: "utility:minimize_window",
    case: "utility:case",
    home: "utility:home",
    search: "utility:search",
    "arrow-right": "utility:chevronright",
    reset: "utility:undo",
    pencil: "utility:edit",
    gear: "utility:setting",
    trash: "utility:trash",
    information: "utility:info",
    help: "utility:help",
    warn: "utility:warning"
  };

  static get sourceTypes() {
    return {
      DATAPAGE: "datapage",
      PAGELIST: "pageList",
      CONSTANT: "constant",
      LOCAL_LIST: "locallist",
      TEXT: "Text"
    };
  }

  static get iconSources() {
    return {
      STANDARD: "standardIcon",
      IMAGE: "image",
      EXTERNAL_URL: "exturl",
      PROPERTY: "property",
      STYLECLASS: "styleclass"
    };
  }

  static get fieldTypes() {
    return {
      TEXTINPUT: "pxTextInput",
      DROPDOWN: "pxDropdown",
      CHECKBOX: "pxCheckbox",
      TEXTAREA: "pxTextArea",
      REPEATING: "repeating",
      TABLELAYOUT: "tableLayout",
      EMAIL: "pxEmail",
      DATETIME: "pxDateTime",
      INTEGER: "pxInteger",
      PERCENT: "pxPercentage",
      PHONE: "pxPhone",
      DISPLAYTEXT: "pxDisplayText",
      HIDDEN: "pxHidden",
      BUTTON: "pxButton",
      LABEL: "label",
      LINK: "pxLink",
      URL: "pxURL",
      ICON: "pxIcon",
      RADIOBUTTONS: "pxRadioButtons",
      AUTOCOMPLETE: "pxAutoComplete",
      CURRENCY: "pxCurrency",
      NUMBER: "pxNumber",
      PXSUBSCRIPT: ""
    };
  }

  static get validateComponentTypeMap() {
    return {
      pxDropdown: "lightning-combobox",
      pxTextArea: "lightning-textarea",
      pxDisplayText: "lightning-formatted-text",
      pxRadioButtons: "lightning-radio-group",
      pxTextInput: "lightning-input",
      pxInteger: "lightning-input",
      pxURL: "lightning-input",
      pxEmail: "lightning-input",
      pxDateTime: "lightning-input",
      pxCheckbox: "lightning-input"
    };
  }

  constructor() {
    super();
    RegExp.escape = function (value) {
      return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    };
  }

  connectedCallback() { 
    if (this.isAttachment() && !this.loading) {
      this.loading = true;
      this.getAttachments();
    }
  }

  renderedCallback() {
    if (!this.hasRendered && this.registerComponent) {
      if (this.fieldObject.control && this.fieldObject.control.type) {
        const lightningComponentType =
          Field.validateComponentTypeMap[this.fieldObject.control.type];
        let component;
        if (lightningComponentType) {
          component = this.template.querySelector(lightningComponentType);
        }
        this.registerComponent(
          this.fieldObject.reference,
          this.fieldObject,
          component,
          this.setValue
        );
      }
    }

    if (!this.hasRendered && !this.isParagraph() && !this.isCaption()) {
      this.value = this.fieldObject.value;
      if (
        this.getWorkObject &&
        this.fieldObject.control &&
        (this.isDropdown() || this.isAutoComplete() || this.isRadioButton())
      ) {
        this.selectedOption = this.value;

        if (this.isRadioButton()) {
          this.setFieldOptions(options => {
            this.radioOptions = options;
          });
        } else {
          if (this.dropdownOptions.length === 0) {
            this.setFieldOptions(options => {
              this.dropdownOptions = options;
            });
          }
        }
      }

      this.hasRendered = true;
    }
  }

  @api
  setValue = async value => {
    if (value && value.refresh && value.paramKey && value.paramValue) {
      this.hasRendered = true;
      this.dropdownOptions = [];
      let options;
      if (this.isRadioButton()) {
        options = await this.setFieldOptions(opt => {
          this.radioOptions = opt;
        }, value);
      } else {
        options = await this.setFieldOptions(opt => {
          this.dropdownOptions = opt;
        }, value);
      }

      this.value = "";
      this.fieldObject = { ...this.fieldObject, value: "" };
      return options;
    }
    this.value = value;
    this.fieldObject = { ...this.fieldObject, value };
    return Promise.resolve(value);
  };

  render() {
    if (this.fieldObject) {
      if (this.isCaption()) return captionField;
      if (this.fieldObject.visible) {
        if (this.isAttachment()) return attachment;
        if (this.isParagraph()) return paragraph;
        if (this.isDisplayText() || this.readonly) return displayText;
        if (this.isTextInput()) return textInput;
        if (this.isDateTime()) return dateTime;
        if (this.isTextArea()) return textArea;
        if (this.isButtton()) return button;
        if (this.isHidden()) return hidden;
        if (this.isDropdown()) return dropdown;
        if (this.isRadioButton()) return radiogroup;
        if (this.isCheckbox()) return checkbox;
        if (this.isLink()) return link;
        if (this.isIcon()) return icon;
        if (this.isImage()) return image;
        if (this.isAutoComplete()) return autocomplete;
      }
    }
    return field;
  }

  fireFieldChangeEvent(evt) {
    let value = evt.target.value;
    if (this.isDropdown() || this.isAutoComplete() || this.isRadioButton()) {
      this.selectedOption = value;
    }
    this.value = value;

    let reference = evt.target.dataset.reference;

    const fieldChangeEvent = new CustomEvent("fieldchanged", {
      bubbles: true,
      composed: true,
      detail: {
        reference,
        value
      }
    });
    this.dispatchEvent(fieldChangeEvent);
  }

  handleClick = evt => {
    if (
      evt.preventDefault &&
      this.fieldObject.control.actionSets &&
      this.fieldObject.control.actionSets.length > 0
    ) {
      evt.preventDefault();
    }
    if (this.fieldClickedHandler) this.fieldClickedHandler(this.fieldObject);
  };

  handleAttachment = async (evt) => {
    if (evt.target.files) {
      const file = evt.target.files[0];
      try {
        this.isLoading = true;
        await apiService.attachFile(this.url, this.getWorkObject().ID, file);
        await this.getAttachments();
      } catch (err) {
        apiService.showError(err, this);
      }
      this.isLoading = false;
    }
  }

  getAttachments = async () => {
    try {
      const response = await apiService.getAttachments(this.url, this.getWorkObject().ID);
      this.caseAttachments = response.attachments;
    } catch (err) {
      apiService.logError(err);
    }
  }

  get showAttachment() {
    return this.caseAttachments && this.caseAttachments.length > 0;
  }

  base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const binaryLen = binaryString.length;
    const bytes = new Uint8Array(binaryLen);
    for (let i = 0; i < binaryLen; i++) {
      const ascii = binaryString.charCodeAt(i);
      bytes[i] = ascii;
    }
    return bytes;
  }

  downloadContent = (base64Data, index) => {
    if (typeof base64Data === 'undefined' ||
    (typeof base64Data === 'string' && base64Data === '')) return;
    if (this.caseAttachments[index].category === 'URL') {
      window.open(base64Data);
      return;
    }
    let filename = this.caseAttachments[index].fileName;
    if (typeof filename === 'undefined') filename = this.caseAttachments[index].name;
    const elem = window.document.createElement('a');
    if (this.caseAttachments[index].category === 'Correspondence') {
      filename = `${this.caseAttachments[index].name}.html`;
      const content = `<html><head><title>${this.caseAttachments[index].name}</title></head><body>${base64Data}</body></html>`;
      const blob = new Blob([content], { type: 'text' });
      elem.href = window.URL.createObjectURL(blob);
    } else {
      const sampleArr = this.base64ToArrayBuffer(base64Data);
      const blob = new Blob([sampleArr], { type: 'application/octet-stream' });
      elem.href = window.URL.createObjectURL(blob);
    }
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  };

  downloadAttachment = async (evt) => {
    try {
      this.isLoading = true;
      const index = evt.target.getAttribute("data-index");
      const itm = this.caseAttachments[index];
      const base64Data = await apiService.downloadAttachment(this.url, itm.ID);
      this.downloadContent(base64Data, index);
    } catch (err) {
      apiService.logError(err);
    }
    this.isLoading = false;
  }

  removeAttachment = async (evt) => {
    evt.preventDefault();
    if (this.isLoading) return;
    const index = evt.target.getAttribute("data-index");
    const itm = this.caseAttachments[index];

    if (apiService.confirm(`Are you sure you want to delete ${itm.name}`)) {      
      try {
        this.isLoading = true;
        await apiService.deleteAttachment(this.url, itm.ID);
        await this.getAttachments();      
      } catch (err) {
        apiService.logError(err);
      }
      this.isLoading = false;
    }
  }

  handleChange = evt => {
    if (evt.target.files) this.handleAttachment(evt);
    else if (this.fieldChangedHandler) this.fieldChangedHandler(evt, this.fieldObject);
  };

  get radiogroupOptions() {
    return this.radioOptions;
  }

  set radiogroupOptions(options) {
    this.radioOptions = options;
  }

  handleClearSearch(evt) {
    if (evt.target.value === this.searchTerm) return;
    this.searchTerm = "";
    this.showOptions = false;
  }

  setAutocompleteOptions() {
    if (!this.dropdownOptions) return;
    let options = [...this.dropdownOptions];
    options = options.filter(
      itm =>
        RegExp.escape(itm.value).search(new RegExp(this.searchTerm, "i")) !== -1
    );
    this.autocompleteOptions = options;
    if (options.length > 0) this.showOptions = true;
  }

  setOption = option => {
    this.fieldChangedHandler(
      {
        target: {
          dataset: { reference: this.fieldObject.reference },
          value: option
        }
      },
      this.fieldObject
    );
  };

  handleSelectOption(evt) {
    let option = evt.target.dataset.option;
    if (!option) {
      option = evt.target.parentElement.dataset.option;
    }
    this.selectedOption = option;
    this.value = option;
    this.showOptions = false;
    this.setOption(option);
  }

  async setFieldOptions(setOptionsFn, refreshParam) {
    if (
      !this.fieldObject ||
      !this.fieldObject.control ||
      !this.fieldObject.control.modes ||
      this.fieldObject.control.modes.length === 0
    )
      return Promise.resolve();
    let mode = this.fieldObject.control.modes[0];

    if (
      !refreshParam &&
      mode.dataPageParams &&
      mode.dataPageParams.length > 0
    ) {
      let noValueForParam = false;
      mode.dataPageParams.forEach(itm => {
        const caseValue = this.caseData[this.fieldObject.reference];
        if (
          !itm.value ||
          !(
            caseValue ||
            (itm.valueReference && itm.valueReference.value) ||
            (itm.valueReference && itm.valueReference.lastSavedValue)
          )
        )
          noValueForParam = true;
      });

      if (noValueForParam) {
        if (mode.options && mode.options.length)
          this.optionsFromLocalList(mode, setOptionsFn);
        else setOptionsFn([]);
        return Promise.resolve();
      }
    }
    if (mode && mode.listSource === Field.sourceTypes.DATAPAGE) {
      return this.dropdownOptionsFromDataPage(mode, setOptionsFn, refreshParam);
    } else if (mode && mode.listSource === Field.sourceTypes.PAGELIST) {
      return this.optionsFromPageList(mode, setOptionsFn);
    } else if (
      mode &&
      mode.listSource === Field.sourceTypes.LOCAL_LIST &&
      mode.options
    ) {
      return this.optionsFromLocalList(mode, setOptionsFn);
    }
    return Promise.resolve();
  }

  handleSearchTermChange(evt) {
    this.searchTerm = evt.target.value;
    if (!this.searchTerm || this.searchTerm.length === 0) {
      this.showOptions = false;
      return;
    }
    this.setAutocompleteOptions();
  }

  optionsFromPageList(mode, setOptionsFn) {
    let pageId = this.fieldObject.control.modes[0].clipboardPageID;
    let clipboardPagePrompt = this.fieldObject.control.modes[0]
      .clipboardPagePrompt;
    let clipboardPageValue = this.fieldObject.control.modes[0]
      .clipboardPageValue;
    if (pageId && clipboardPagePrompt && clipboardPageValue) {
      let workObject = this.getWorkObject();
      if (workObject) {
        let optionsPage = workObject.content[pageId];
        if (optionsPage && optionsPage.length > 0) {
          setOptionsFn(
            optionsPage.map(item => {
              return {
                label: item[clipboardPagePrompt],
                value: item[clipboardPageValue]
              };
            })
          );
        }
      }
    }
  }

  optionsFromLocalList(mode, setOptionsFn) {
    setOptionsFn(
      mode.options.map(option => {
        return {
          label: option.value,
          value: option.key
        };
      })
    );
  }

  async dropdownOptionsFromDataPage(mode, setOptionsFn, refreshParam) {
    try {
      let pageId = mode.dataPageID;
      let propertyName = mode.dataPageValue;
      let propertyPrompt = mode.dataPagePrompt;
      let pageParams = {};

      let noParamValue = false;
      if (mode.dataPagePrompt) {
        mode.dataPageParams.forEach(param => {
          let val = param.value;
          if (param.valueReference) {
            if (this.caseData[param.valueReference.reference]) {
              val = this.caseData[param.valueReference.reference];
            } else {
              val = param.valueReference.lastSavedValue;
            }
          }
          if (!val && !noParamValue) noParamValue = true;
          else pageParams[param.name] = apiService.decodeHTML(val);
        });
      }
      if (noParamValue) return [];
      if (refreshParam) {
        pageParams[refreshParam.paramKey] = refreshParam.paramValue;
      }

      let data;
      try {
        data = await apiService.getDataPage(this.url, pageId, pageParams);
      } catch (err) {
        data = [];
      }

      let options = this.convertDataPageToOptions(
        data,
        propertyName,
        propertyPrompt
      );
      setOptionsFn(options);
      return options;
    } catch (error) {
      apiService.showError(error, this);
      this.dropdownOptions = [{ label: error, value: error }];
    }
    return [];
  }

  convertDataPageToOptions(dataPage, propertyName, propertyPrompt) {
    let options = [];
    if (propertyName.indexOf(".") === 0) {
      propertyName = propertyName.substring(1);
    }

    dataPage.pxResults.forEach(result => {
      if (result[propertyName]) {
        options.push({
          label: result[propertyPrompt],
          value: result[propertyName]
        });
      }
    });
    return options;
  }

  getPropertyValue(property) {
    if (typeof property === "boolean") {
      return property;
    }
    if (property.charAt(0) === '"') {
      return property.replace(/"/g, "");
    }
    if (property.charAt(0) === ".") {
      return this.state.values[this.expandRelativePath(property)];
    }
    return property;
  }

  @api
  reportError(reference, msg) {
    if (this.fieldObject.reference === reference) {
      const controlType =
        Field.validateComponentTypeMap[this.fieldObject.control.type];
      let input = this.template.querySelector(controlType);
      if (input) {
        // let input = this.template.querySelector("lightning-input");
        input.setCustomValidity(msg);
        input.reportValidity();
      }
    }
  }

  isCheckbox() {
    return this.fieldObject.control.type === Field.fieldTypes.CHECKBOX;
  }

  isRadioButton() {
    return this.fieldObject.control.type === Field.fieldTypes.RADIOBUTTONS;
  }

  isAutoComplete() {
    return this.fieldObject.control.type === Field.fieldTypes.AUTOCOMPLETE;
  }

  isDropdown() {
    return this.fieldObject.control.type === Field.fieldTypes.DROPDOWN;
  }

  isHidden() {
    return this.fieldObject.control.type === Field.fieldTypes.HIDDEN;
  }

  isTextArea() {
    return this.fieldObject.control.type === Field.fieldTypes.TEXTAREA;
  }

  isParagraph() {
    return (
      this.fieldObject.paragraphID && this.fieldObject.paragraphID.length > 0
    );
  }

  isCaption() {
    return this.fieldObject.hasOwnProperty("captionFor");
  }

  isAttachment() {
    return this.fieldObject.reference &&
      this.fieldObject.control.type === "pxTextInput" &&
      this.fieldObject.reference.startsWith("AttachRef.pxResults");
  }

  isTextInput() {
    return this.fieldObject.control.type === Field.fieldTypes.TEXTINPUT
    || this.fieldObject.control.type === Field.fieldTypes.PHONE
    || this.fieldObject.control.type === Field.fieldTypes.EMAIL
    || this.fieldObject.control.type === Field.fieldTypes.INTEGER
    || this.fieldObject.control.type === Field.fieldTypes.URL
    || this.fieldObject.control.type === Field.fieldTypes.CURRENCY
    || this.fieldObject.control.type === Field.fieldTypes.NUMBER
    || this.fieldObject.control.type === Field.fieldTypes.PERCENT;
  }

  get isCurrencyInput() {
    return this.fieldObject.control.type === Field.fieldTypes.CURRENCY
  }

  get isNumberInput() {
    return this.fieldObject.control.type === Field.fieldTypes.NUMBER;
  }

  get isPercentageInput() {
    return this.fieldObject.control.type === Field.fieldTypes.PERCENT;
  }    

  get isIntegerInput() {
    return this.fieldObject.control.type === Field.fieldTypes.INTEGER;
  }

  get isPhoneInput() {
    return this.fieldObject.control.type === Field.fieldTypes.PHONE;
  }    

  get isUrlInput() {
    return this.fieldObject.control.type === Field.fieldTypes.URL;
  }    

  get isEmailInput() {
    return this.fieldObject.control.type === Field.fieldTypes.EMAIL;
  }

  get isPlainTextInput() {
    return this.fieldObject.control.type === Field.fieldTypes.TEXTINPUT;
  }

  get decimalPlaces() {
    if (this.fieldObject.control.modes && this.fieldObject.control.modes[1].decimalPlaces) {
      return 1 / Math.pow(10, this.fieldObject.control.modes[1].decimalPlaces);
    } 
    return 0.01;
  }

  get currencyValue() {
    const currencyValue = this.fieldObject.value ? Number(this.fieldObject.value).toFixed(2) : ""
    return currencyValue;
  }  

  isDateTime() {
    return this.fieldObject.control.type === Field.fieldTypes.DATETIME;
  }

  get fieldDataExists() {
    return typeof this.fieldObject && this.fieldObject.control;
  }

  get href() {
    const linkMode = this.fieldObject.control.modes[0]
      ? this.fieldObject.control.modes[0]
      : {};
    const href = this.getPropertyValue(linkMode.linkData);
    return href ? href : "#";
  }

  get textInputVariant() {
    return "Neutral";
  }

  get isVisible() {
    return this.fieldObject && this.fieldObject.visible;
  }

  get caption() {
    return apiService.decodeHTML(this.fieldObject.value);
  }

  get iconName() {
    let iconName = "utility:info";
    if (this.fieldObject.control && this.fieldObject.control.modes) {
      const iconMode = this.fieldObject.control.modes[0]
        ? this.fieldObject.control.modes[0]
        : {};
      if (iconMode.iconSource === Field.iconSources.STANDARD) {
        iconName = this.standardIcons[iconMode.iconStandard];
      } else if (iconMode.iconSource === Field.iconSources.STYLECLASS) {
        let iconStyle = iconMode.iconStyle;
        if (iconStyle.indexOf("pi") >= 0) {
          iconStyle = iconStyle.replace(/pi pi-/gi, "");
          iconName = this.standardIcons[iconStyle];
        }
      }
    }
    return iconName ? iconName : "utility:info";
  }

  get imgUrl() {
    return this.fieldObject.control.modes && this.fieldObject.control.modes.length > 0 ?
      this.fieldObject.control.modes[0].iconUrl : "";
  }

  get imgWidth() {
    if (this.fieldObject.control.modes && this.fieldObject.control.modes.length && this.fieldObject.control.modes[0].iconUrl) {
      const imgName = this.fieldObject.control.modes[0].iconUrl.substring(
          this.fieldObject.control.modes[0].iconUrl.lastIndexOf("/") + 1);
      const imgParts = imgName.split("_");
      if (imgParts.length > 2) return imgParts[0]
    }
    return "";
  }

  get imgHeight() {
    if (this.fieldObject.control.modes && this.fieldObject.control.modes.length && this.fieldObject.control.modes[0].iconUrl) {
      const imgName = this.fieldObject.control.modes[0].iconUrl.substring(
          this.fieldObject.control.modes[0].iconUrl.lastIndexOf("/") + 1);
      const imgParts = imgName.split("_");
      if (imgParts.length > 2) return imgParts[1]
    }
    return "";
  }

  get currencyCode() {
    return CURRENCY;
  }

  get locale() {
    return LOCALE;
  }

  get buttonVariant() {
    let buttonFormat = "Neutral";
    if (
      this.fieldObject &&
      this.fieldObject.control &&
      this.fieldObject.control.modes &&
      this.fieldObject.control.modes.length > 1
    ) {
      let format = this.fieldObject.control.modes[1].controlFormat;
      if (format) {
        format = format.toUpperCase();
        if (format !== "STANDARD" && format !== "PZHC") {
          if (format === "STRONG") buttonFormat = "brand";
          else if (format === "LIGHT") {
            buttonFormat = "";
          } else if (format === "RED") buttonFormat = "destructive";
        }
      }
    }
    return buttonFormat;
  }

  get linkStyle() {
    let linkFormat = "";
    if (
      this.fieldObject &&
      this.fieldObject.control &&
      this.fieldObject.control.modes &&
      this.fieldObject.control.modes.length > 1
    ) {
      let format = this.fieldObject.control.modes[1].controlFormat;
      if (format) {
        format = format.toUpperCase();
        if (format === "STRONG") linkFormat = "fontWeight: bolder";
        else if (format === "LIGHT") {
          linkFormat = "fontWeight: lighter; color: lightgray";
        } else if (format === "STANDARD" && format === "PZHC")
          linkFormat = "fontWeight: normal";
        else if (format === "RED") linkFormat = "color: red";
      }
    }
    return linkFormat;
  }

  get label() {
    if (this.hideLabel) return " ";
    let labelValue;
    if (this.isButtton() || this.isLink() || this.isCheckbox()) {
      if (this.fieldObject.control && this.fieldObject.control.label) {
        labelValue = apiService.decodeHTML(
          this.getPropertyValue(this.fieldObject.control.label)
        );
      }
    } else {
      labelValue = apiService.decodeHTML(this.fieldObject.label);
    }

    return labelValue && labelValue.length > 0 ? labelValue : " ";
  }

  get fieldLabel() {
    const label =
      this.fieldObject.label && this.fieldObject.showLabel
        ? this.fieldObject.label
        : undefined;
    if (label) return apiService.decodeHTML(label);
    return label;
  }

  get disabled() {
    if (this.isCheckbox() || this.isRadioButton()) {
      return this.readonly || this.fieldObject.disabled === true;
    }
    return this.fieldObject.disabled === true;
  }

  get required() {
    return this.fieldObject.required === true;
  }

  get readonly() {
    return this.fieldObject.readOnly === true;
  }

  get placeholder() {
    let placeholder;
    if (
      this.fieldObject &&
      this.fieldObject.control &&
      this.fieldObject.control.modes &&
      this.fieldObject.control.modes.length > 0
    ) {
      placeholder = this.fieldObject.control.modes[0].placeholder;
    }
    return placeholder;
  }

  get tooltip() {
    let tooltip = "";
    if (
      this.fieldObject &&
      this.fieldObject.control &&
      this.fieldObject.control.modes &&
      this.fieldObject.control.modes.length > 1
    ) {
      if (
        this.fieldObject.control.type === Field.fieldTypes.BUTTON ||
        this.fieldObject.control.type === Field.fieldTypes.LINK ||
        this.fieldObject.control.type === Field.fieldTypes.ICON
      ) {
        if (this.fieldObject.control.modes[1].tooltip) {
          tooltip = this.fieldObject.control.modes[1].tooltip;
        }
      } else {
        if (this.fieldObject.control.modes[0].tooltip) {
          tooltip = this.fieldObject.control.modes[0].tooltip;
        }
      }
    }
    return apiService.decodeHTML(tooltip);
  }

  get richText() {
    return this.fieldObject.value;
  }

  get checked() {
    return (
      this.fieldObject &&
      (this.fieldObject.value === "true" || this.fieldObject.value === true)
    );
  }

  get formatReadWritetType() {
    let type = "text";
    if (!this.fieldObject.control || !this.fieldObject.control.modes) {
      return type;
    }
    let fieldType = this.fieldObject.control.type;
    if (fieldType === Field.fieldTypes.DATETIME) {
      if (this.fieldObject.type.toUpperCase() === "DATE") type = "date";
      else if (this.fieldObject.type.toUpperCase() === "DATE TIME")
        type = "datetime";
      else type = "date";
    }
    if (this.fieldObject.control.modes.length < 1) {
      return type;
    }

    let formatType = this.fieldObject.control.modes[0].formatType;
    if (fieldType === Field.fieldTypes.EMAIL || formatType === "email") {
      type = "email";
    } else if (fieldType === Field.fieldTypes.PHONE || formatType === "tel") {
      type = "tel";
    } else if (fieldType === Field.fieldTypes.URL || formatType === "url") {
      type = "url";
    } else if (
      fieldType === Field.fieldTypes.INTEGER ||
      fieldType === Field.fieldTypes.CURRENCY ||
      formatType === "number"
    ) {
      type = "number";
    }
    return type;
  }

  get isFormattedText() {
    if (!this.fieldObject) return false;
    if (
      this.fieldObject &&
      this.fieldObject.control &&
      this.fieldObject.control.modes.length > 0 &&
      this.fieldObject.value
    ) {
      let mode = this.fieldObject.control.modes[1];
      if (!mode) return false;
      if (
        (mode.dateFormat && mode.dateFormat.match(/Date-/i)) ||
        (mode.dateTimeFormat && mode.dateTimeFormat.match(/DateTime-/i)) ||
        mode.formatType === "number" ||
        (mode.formatType === "text" &&
          (mode.autoAppend || mode.autoPrepend)) ||
        mode.formatType === "truefalse" ||
        mode.formatType === "email" ||
        mode.formatType === "tel" ||
        mode.formatType === "url" ||
        (mode.formatType === "text" && (mode.autoAppend || mode.autoPrepend))
      ) {
        return true;
      }
    }
    return false;
  }

  get isFormattedString() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.formatType === "text" && (mode.autoAppend || mode.autoPrepend);
  }

  get isFormattedNumber() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return !this.isFormattedPercentage && mode.formatType === "number" && mode.numberSymbol !== "currency";
  }

  get isFormattedPercentage() {
    if (!this.isFormattedText) return false;
    return this.fieldObject.control.type === Field.fieldTypes.PERCENT;
  }   

  get isFormattedCurrency() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.formatType === "number" && mode.numberSymbol === "currency";
  }

  get isFormattedTrueFalse() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.formatType === "truefalse";
  }

  get isFormattedDate() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.dateFormat && mode.dateFormat.match(/Date-/i);
  }

  get isFormattedDateTime() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.dateTimeFormat && mode.dateTimeFormat.match(/DateTime-/i);
  }

  get isFormattedEmail() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.formatType === "email";
  }

  get isFormattedUrl() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.formatType === "url";
  }

  get isFormattedTel() {
    if (!this.isFormattedText) return false;
    let mode = this.fieldObject.control.modes[1];
    return mode.formatType === "tel";
  }

  get formattedValue() {
    if (!this.isFormattedText) return "";
    let mode = this.fieldObject.control.modes[1];
    let returnValue = this.fieldObject.value;

    if (mode.formatType === "text" && (mode.autoAppend || mode.autoPrepend)) {
      returnValue = mode.autoPrepend
        ? mode.autoPrepend + returnValue
        : returnValue;
      returnValue = mode.autoAppend
        ? returnValue + mode.autoAppend
        : returnValue;
    } else if (mode.formatType === "truefalse") {
      if (returnValue === "false") returnValue = mode.falseLabel;
      else returnValue = mode.trueLabel;
    }

    return returnValue;
  }

  get month() {
    let mode = this.fieldObject.control.modes[1];
    if (mode.dateTimeFormat && mode.dateTimeFormat === "DateTime-Short")
      return "2-digit";
    if (mode.dateFormat && mode.dateFormat === "Date-Short") return "2-digit";
    return "long";
  }

  isDisplayText() {
    return this.fieldObject.control.type === Field.fieldTypes.DISPLAYTEXT;
  }

  isButtton() {
    return this.fieldObject.control.type === Field.fieldTypes.BUTTON;
  }

  isLabel() {
    return this.fieldObject.control.type === Field.fieldTypes.LABEL;
  }

  isLink() {
    return this.fieldObject.control.type === Field.fieldTypes.LINK;
  }

  isIcon() {
    return this.fieldObject.control.type === Field.fieldTypes.ICON &&
      this.fieldObject.control.modes && this.fieldObject.control.modes.length > 0 &&
      (this.fieldObject.control.modes[0].iconSource === "styleclass"
        || this.fieldObject.control.modes[0].iconSource === "standardIcon"
        || this.fieldObject.control.modes[0].iconSource === "image"
      );
  }

  isImage() {
    return this.fieldObject.control.type === Field.fieldTypes.ICON &&
      this.fieldObject.control.modes && this.fieldObject.control.modes.length > 0 &&
      this.fieldObject.control.modes[0].iconSource === "exturl";
  }

  isLHidden() {
    return this.fieldObject.control.type === Field.fieldTypes.HIDDEN;
  }

  isSubscript() {
    return this.fieldObject.control.type === Field.fieldTypes.PXSUBSCRIPT;
  }
}
