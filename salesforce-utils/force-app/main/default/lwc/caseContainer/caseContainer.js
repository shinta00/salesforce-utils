import { LightningElement, api, track, wire } from "lwc";
import { apiService } from "c/service";
import perform from "./perform.html";
import confirm from "./confirm.html";
import newHarness from "./new.html";
import Field from "c/field";
import ReferenceHelper from "c/referenceHelper";
import { CurrentPageReference } from "lightning/navigation";
import { fireEvent } from "c/pegapubsub";

export default class CaseContainer extends LightningElement {
  @api assignmentId;
  @api caseId;
  @api newHarnessView;
  @api processId;
  @api caseType;
  @api hideButtonsArea;
  @api url;
  @track workObject;
  @track stages = [];
  @track currentStage = "";
  @track actions = [{ label: "Refresh", value: "Refresh" }];
  @track view = {};
  @track validationErrors = [];
  @track confirmHarnessMode;
  @track showSpinner;
  @track caseData = {};
  @wire(CurrentPageReference) pageRef;
  emptyView = { groups: [], visible: true };
  componentRegistry = {};
  assignment;
  caseDetails;
  currentAction;
  flowAction;
  graph;

  static get actionNames() {
    return {
      SET_VALUE: "setValue",
      POST_VALUE: "postValue",
      REFRESH: "refresh",
      PERFORM_ACTION: "takeAction",
      RUN_SCRIPT: "runScript",
      OPEN_URL: "openUrlInWindow"
    };
  }

  static get supportedActions() {
    return [
      CaseContainer.actionNames.POST_VALUE,
      CaseContainer.actionNames.SET_VALUE,
      CaseContainer.actionNames.REFRESH,
      CaseContainer.actionNames.PERFORM_ACTION,
      CaseContainer.actionNames.RUN_SCRIPT,
      CaseContainer.actionNames.OPEN_URL
    ];
  }

  static get gridTypes() {
    return {
      GROUP: "Group",
      LIST: "List"
    };
  }

  connectedCallback() {
    if (this.assignmentId && this.caseId) {
      this.getAssignment();
      this.confirmHarnessMode = false;
    }
  }

  render() {
    if (this.confirmHarnessMode) return confirm;
    if (this.newHarnessView) return newHarness;
    return perform;
  }

  async getAssignment(actionName) {
    try {
      this.showSpinner = true;
      this.currentAction = null;
      this.caseData = {};
      let assignment = await apiService.getAssignment(
        this.url,
        this.assignmentId
      );
      this.assignment = assignment;
      if (this.assignment.actions && this.assignment.actions.length > 0) {
        this.currentAction = actionName
          ? actionName
          : this.assignment.actions[0].ID;
        this.flowAction = this.assignment.actions[0].ID;
        this.fireChangeTitleEvent();
        this.workObject = await apiService.getCase(this.url, this.caseId);
        this.currentStage = this.workObject.stage;
        this.setStages();
        this.setActions();
        this.view = this.emptyView;
        let view = await apiService.getFieldsForAssignment(
          this.url,
          this.assignmentId,
          this.currentAction
        );
        this.caseData = {};
        this.componentRegistry = {};
        this.view = view;
        let { caseData, graph } = ReferenceHelper.getInitialValuesFromView(
          this.view.view
        );
        this.graph = graph;
        this.caseData = caseData;
        this.template.querySelector("c-view").setView(this.view.view);
        this.showSpinner = false;
      }
      return assignment;
    } catch (error) {
      this.template.querySelector("c-view").setView({});
      this.showSpinner = false;
      apiService.showError(error, this);
      return Promise.reject();
    }
  }

  addToGraph(reference, field, component, setValue) {
    if (
      !this.graph || !this.graph.graphMap[field.index] ||
      !field.control.modes ||
      field.control.modes.length === 0
    )
      return;
    const newNode = { field, component, setValue };
    this.graph.idMap[field.index] = newNode;
    this.graph.referenceMap[field.reference].forEach(
      itm => itm !== field.index && this.graph.graphMap[field.index].add(itm)
    );
    let mode = field.control.modes[0];
    if (mode.dataPageParams) {
      mode.dataPageParams.forEach(async param => {
        if (param.valueReference && param.valueReference.reference) {
          this.graph.referenceMap[param.valueReference.reference].forEach(k =>
            this.graph.graphMap[k].add(field.index)
          );
        }
      });
    }
  }

  registerComponent = (reference, field, component, setValue) => {
    if (!reference || !field) return;
    this.addToGraph(reference, field, component, setValue);
    const newField = { field, setValue };
    if (component) newField.component = component;
    if (!this.componentRegistry[reference]) {
      this.componentRegistry[reference] = [newField];
    } else {
      for (let i = 0; i < this.componentRegistry[reference].length; i++) {
        if (
          this.componentRegistry[reference][i].field.testID === field.testID
        ) {
          this.componentRegistry[reference].splice(i, 1);
          break;
        }
      }
      this.componentRegistry[reference].push(newField);
    }
  };

  resetAssignment() {
    this.template.querySelector("c-view").setView(null);
    this.currentAction = null;
  }

  setNewHarnessView(newHarnessView) {
    this.newHarnessView = newHarnessView;
  }

  setActions = () => {
    let actions = this.assignment.actions.map(itm => {
      return {
        label: itm.name,
        value: itm.ID
      };
    });
    actions.shift();
    actions.unshift({ label: "Refresh", value: "Refresh" });
    this.actions = actions;
    this.actions.push({ label: this.assignment.actions[0].name, value: this.flowAction });
  };

  setStages = () => {
    let stages = this.workObject.stages.map(itm => {
      return {
        label: itm.name,
        value: itm.ID
      };
    });
    this.stages = stages;
  };

  showToast = () => {
    apiService.showError(null, this);
  };

  fireChangeTitleEvent = () => {
    let action = this.currentAction;
    if (this.assignment.actions && this.assignment.actions.length > 0) {
      action = this.assignment.actions[0].name;
    }
    const changeTitle = new CustomEvent("changetitle", {
      bubbles: true,
      detail: {
        caseName: this.assignment.name,
        caseId: this.caseId.split(" ")[1],
        assignmentId: this.assignmentId,
        caseKey: this.caseId,
        action
      }
    });
    this.dispatchEvent(changeTitle);
  };

  handleGridAction(evt) {
    this.showSpinner = true;
    if (evt.detail.referenceType === CaseContainer.gridTypes.LIST) {
      this.handlePageListAction(evt.detail.reference, evt.detail.action);
    } else {
      this.handlePageGroupAction(evt.detail.reference, evt.detail.action);
    }
    this.showSpinner = false;
  }

  async handlePageListAction(reference, action) {
    let postContent = ReferenceHelper.getPostContent(
      this.caseData,
      this.componentRegistry
    );
    let target = ReferenceHelper.getRepeatFromReference(
      reference,
      CaseContainer.gridTypes.LIST,
      postContent
    );
    if (action === "add") {
      target.push(ReferenceHelper.getBlankRowForRepeat(target));
    } else if (target.length > 1) {
      target.pop();
    }
    let content = { content: postContent };
    return this.refreshAssignment(content);
  }

  handlePageGroupAction(reference, action) {
    let isRemove = action === "delete";
    let postContent = ReferenceHelper.getPostContent(
      this.caseData,
      this.componentRegistry
    );
    let target = ReferenceHelper.getRepeatFromReference(
      reference,
      CaseContainer.gridTypes.GROUP,
      postContent
    );
    const name = isRemove
      ? apiService.prompt("Enter the name of the group to be deleted.")
      : apiService.prompt("Enter a name for the group.");
    if (!name) return;
    if (isRemove) {
      delete target[name];
    } else {
      target[name] = {};
    }
    let content = { content: postContent };
    this.refreshAssignment(content);
  }

  async refreshAssignment(content) {
    this.showSpinner = true;
    try {
      let view = await apiService.performRefreshOnAssignment(
        this.url,
        this.assignmentId,
        this.currentAction,
        content
      );
      this.componentRegistry = {};
      this.caseData = {};
      this.view = view;
      let { caseData, graph } = ReferenceHelper.getInitialValuesFromView(
        this.view.view
      );
      this.graph = graph;
      this.caseData = caseData;
      this.template.querySelector("c-view").setView(this.view.view);
      return Promise.resolve(view);
    } catch (error) {
      apiService.showError(error, this);
      return Promise.reject(error);
    } finally {
      this.showSpinner = false;
    }
  }

  getActionData(field, targetActions) {
    let result = [];
    if (field.control && field.control.actionSets) {
      let actionSets = field.control.actionSets;
      for (let i = 0; i < actionSets.length; i++) {
        let actions = actionSets[i].actions;
        let events = actionSets[i].events;
        for (let j = 0; j < actions.length; j++) {
          if (
            targetActions.some(
              targetAction => targetAction === actions[j].action
            )
          ) {
            result.push({ ...actions[j], events: events });
          }
        }
      }
    }
    return result;
  }

  generateEventHandler(field) {
    let actionData = this.getActionData(field, CaseContainer.supportedActions);
    let hasFieldRefresh = false;
    let actionsList = [];
    for (let i = 0; i < actionData.length; i++) {
      switch (actionData[i].action) {
        case CaseContainer.actionNames.SET_VALUE:
          actionsList.push({
            handler: this.handleSetValue,
            data: actionData[i].actionProcess
          });
          break;
        case CaseContainer.actionNames.POST_VALUE:
          if (!hasFieldRefresh) {
            actionsList.push({
              handler: this.handleFieldRefresh,
              data: actionData[i].actionProcess
            });
            hasFieldRefresh = true;
          }
          break;
        case CaseContainer.actionNames.REFRESH:
          if (!hasFieldRefresh) {
            actionsList.push({
              handler: this.handleFieldRefresh,
              data: actionData[i].actionProcess,
              refreshFor: actionData[i].refreshFor
            });
            hasFieldRefresh = true;
          }
          break;
        case CaseContainer.actionNames.PERFORM_ACTION:
          actionsList.push({
            handler: this.handlePerform,
            data: actionData[i].actionProcess
          });
          break;
        case CaseContainer.actionNames.OPEN_URL:
          actionsList.push({
            handler: this.handleOpenUrl,
            data: actionData[i].actionProcess
          });
          break;
        default:
          break;
      }
    }
    return this.createEventHandler(actionsList);
  }

  createEventHandler = actionHandlers => {
    actionHandlers.push({
      handler: this.callUpdateDependencies
    });

    let eventHandler = (evt, value) => {
      actionHandlers.reduce((promise, actionHandler) => {
        return promise.then(() =>
          actionHandler.handler.call(this, evt, actionHandler, value)
        );
      }, Promise.resolve());
    };
    return eventHandler;
  };

  expandRelativePath = relPath => {
    if (relPath.charAt(0) === ".") {
      return relPath.substring(1);
    }
    return relPath;
  };

  handleFieldRefresh = (evt, actionData) => {
    let postContent = ReferenceHelper.getPostContent(
      this.caseData,
      this.componentRegistry
    );
    let content = { content: postContent };
    if (actionData && actionData.refreshFor) {
      ReferenceHelper.addEntry("refreshFor", actionData.refreshFor, content, this.componentRegistry);
    }
    return this.refreshAssignment(content);
  };

  handleSetValue = (evt, actionData) => {
    if (actionData.data && actionData.data.setValuePairs) {
      actionData.data.setValuePairs.forEach(pair => {
        let val;
        let fullPath = this.expandRelativePath(pair.name);
        if (pair.valueReference) {
          val = this.getPropertyValue(pair.valueReference.reference);
          if (!val || val === pair.valueReference.reference) {
            val = apiService.decodeHTML(pair.valueReference.lastSavedValue);
          }
        } else {
          val = this.getPropertyValue(pair.value);
        }
        ReferenceHelper.addEntry(fullPath, val, this.caseData, this.componentRegistry);
        let entries = this.componentRegistry[fullPath];
        if (entries) {
          entries.forEach(entry => entry.setValue(val));
        }
      });
    }
  };

  handlePerform(evt, actionData) {
    return this.getAssignment(actionData.data.actionName);
  }

  async handleCreateWork() {
    try {
      this.showSpinner = true;
      let caseData = ReferenceHelper.getPostContent(
        this.caseData,
        this.componentRegistry
      );
      let postData = {
        caseTypeID: this.caseType,
        processID: this.processId,
        content: caseData
      };
      let newCase = await apiService.createCase(this.url, postData);
      if (newCase && newCase.ID) {
        this.caseId = newCase.ID;
        this.assignmentId = newCase.nextAssignmentID;
        this.getAssignment();
        fireEvent(this.pageRef, "workObjectCreated", newCase.ID);
      } else {
        apiService.showError("Could not create a new case", this);
        this.handleCancel();
      }
      this.newHarnessView = null;
      this.processId = null;
      this.caseType = null;
    } catch (err) {
      apiService.showError(err, this);
      this.handleCancel();
    }
    this.showSpinner = false;
  }

  handleOpenUrl = (evt, actionData) => {
    let url;
    if (actionData.data.alternateDomain) {
      url = actionData.data.alternateDomain.url;
      if (!url && actionData.data.alternateDomain.urlReference)
        url = this.getPropertyValue(
          actionData.data.alternateDomain.urlReference.reference,
          actionData.data.alternateDomain.urlReference
        );
      if (!url) {
        url = apiService.decodeHTML(
          actionData.data.alternateDomain.urlReference.lastSavedValue
        );
      }
    }
    if (url.indexOf("http") !== 0) {
      url = "http://" + url.replace(/"/g, "");
    }
    let queryParams = actionData.data.queryParams
      .map(param => {
        let parmValue;
        if (param.value) parmValue = param.value;
        else if (param.valueReference.reference)
          parmValue = this.getPropertyValue(
            param.valueReference.reference,
            param.valueReference
          );
        if (!parmValue)
          parmValue = apiService.decodeHTML(
            param.valueReference.lastSavedValue
          );
        return `${param.name}=${parmValue}`.replace(/"/g, "");
      })
      .join("&");
    if (queryParams) url += "?" + queryParams;
    window.open(url, actionData.data.windowName, actionData.data.windowOptions);
  };

  getPropertyValue = (property, valueReference) => {
    if (typeof property === "boolean") {
      return property;
    }
    let value;
    if (property.charAt(0) === '"') {
      value = property.replace(/"/g, "");
    } else {
      value = this.caseData[this.expandRelativePath(property)];
      if (valueReference && !value) {
        if (valueReference.lastSavedValue)
          return apiService.decodeHTML(valueReference.lastSavedValue);
        return null;
      }
    }
    if (!value) value = property;
    return value;
  };

  isCheckbox(reference) {
    if (this.componentRegistry[reference]) {
      let field = this.componentRegistry[reference][0].field;
      if (
        field &&
        field.control &&
        field.control.type === Field.fieldTypes.CHECKBOX
      ) {
        return true;
      }
    }
    return false;
  }

  isDateTime(reference) {
    if (this.componentRegistry[reference]) {
      let field = this.componentRegistry[reference][0].field;
      if (
        field &&
        field.control &&
        field.control.type === Field.fieldTypes.DATETIME
      ) {
        return true;
      }
    }
    return false;
  }

  isDate(reference) {
    if (this.componentRegistry[reference]) {
      let field = this.componentRegistry[reference][0].field;
      if (
        field.type === "Date" &&
        field.control &&
        field.control.type === Field.fieldTypes.DATETIME
      ) {
        return true;
      }
    }
    return false;
  }

  handleCaseActions(evt) {
    const selectedAction = evt.target.value;
    if (selectedAction === "Refresh") {
      if (!this.showSpinner) this.showSpinner = true;
      this.handleFieldRefresh().then(() => {
        Promise.resolve();
        this.showSpinner = false;
      });
    } else {
      this.getAssignment(selectedAction);
    }
  }

  handleFieldClicked = field => {
    if (!field) return;
    const eventHandler = this.generateEventHandler(field);
    if (!eventHandler) return;
    eventHandler(field);
  };

  handleFieldBlured = evt => {
    if (!evt) return;
    let value = evt.target.value;
    let reference = evt.target.dataset.reference;
    if (!reference) return;
    ReferenceHelper.addFieldData(reference, value, this.caseData);
  };

  handleFieldChanged = async (evt, field) => {
    if (!evt) return;

    let reference = evt.target.dataset.reference;
    if (!reference) return;
    let value = evt.target.value;
    if (this.isCheckbox(reference)) {
      value = evt.target.checked;
    }

    if (field.index && this.graph.idMap[field.index].setValue) {
      this.graph.idMap[field.index].setValue(value);
    }
    if (this.isDate(field)) {
      value = value.replaceAll("-", "");
    }
    ReferenceHelper.addFieldData(reference, value, this.caseData);
    let eventHandler = this.generateEventHandler(field, value);
    eventHandler(field, value);
  };

  updateDependencies(field, value, processedGraphNodes) {
    if (
      processedGraphNodes.has(field.index) ||
      !this.graph.graphMap[field.index]
    )
      return;
    processedGraphNodes.add(field.index);
    this.graph.graphMap[field.index].forEach(async nodeId => {
      const dependentField = this.graph.idMap[nodeId];
      const mode = dependentField.field.control.modes[0];
      if (field.reference === dependentField.field.reference) {
        dependentField.setValue(value);
        this.caseData[field.reference] = value;
        processedGraphNodes.add(dependentField.field.index);
      } else if (mode.dataPageID) {
        if (mode.dataPageParams && mode.dataPageParams.length > 0) {
          const dataParamValues = { refresh: true };
          dataParamValues.params = mode.dataPageParams;
          mode.dataPageParams.forEach(param => {
            if (
              param.valueReference &&
              param.valueReference.reference === field.reference
            ) {
              dataParamValues.paramKey = param.name;
              dataParamValues.paramValue = value;
            }
          });
          let options = await dependentField.setValue(dataParamValues);
          if (options && options.length > 0) {
            let val = options[0].value;
            dependentField.setValue(val);
            this.caseData[dependentField.field.reference] = val;
            this.updateDependencies(
              dependentField.field,
              val,
              processedGraphNodes
            );
          }
        }
      }
    });
  }

  async callUpdateDependencies(field, _, value) {
    this.updateDependencies(field, value, new Set())
  }

  reportError(reference, msg) {
    if (!reference || !msg) return;
    let v = this.template.querySelector("c-view");
    if (reference.startsWith(".")) reference = reference.substring(1);
    v.reportError(reference, msg);
  }

  clear() {
    this.view = this.emptyView;
    this.template.querySelector("c-view").setView(this.view);
  }

  async handlePerformAction() {
    this.validationErrors = [];
    try {
      let postData = ReferenceHelper.getPostContent(
        this.caseData,
        this.componentRegistry
      );
      let content = { content: postData };
      this.showSpinner = true;
      let assignment = await apiService.performAction(
        this.url,
        this.assignmentId,
        this.currentAction,
        content
      );
      this.clear();
      this.assignmentId = assignment.nextAssignmentID;
      let workObject = await apiService.getCase(this.url, this.caseId);
      this.workObject = workObject;
      if (this.assignmentId) {
        return this.getAssignment();
      } else if (assignment.nextPageID) {
        this.view = this.emptyView;
        this.switchToConfirmMode();
        this.view = await apiService.getPage(
          this.url,
          this.caseId,
          assignment.nextPageID
        );
        this.view.visible = true;
        this.template.querySelector("c-view").setView(this.view);
        this.showSpinner = false;
      } else {
        throw new Error(
          "Invalid server response, please contact your administrator"
        );
      }
    } catch (err) {
      apiService.logError(err);      this.showSpinner = false;
      if (!err.errors) {
        apiService.showError(err, this);
      } else {
        let msgShown = false;
        if (this.isValidationError(err)) {
          err.errors.forEach(error => {
            if (error.ValidationMessages) {
              error.ValidationMessages.forEach(msg => {
                if (msg.Path) {
                  this.validationErrors.push(msg);
                  msgShown = true;
                } else if (!msgShown && error.ValidationMessages.length === 1) {
                  apiService.showError(msg.ValidationMessage, this);
                  msgShown = true;
                }
              });
            }
          });
        } else {
          apiService.showError(err, this);
        }
        if (this.isValidationError(err)) {
          this.submitError = err;
        }
      }
    }
    return this.view;
  }

  renderedCallback() {
    if (this.submitError && this.submitError.errors && this.submitError.errors.length > 0 && this.submitError.errors[0].ValidationMessages) {    
      this.validationErrors.forEach(error => {
        this.reportValidity(error.Path, error.ValidationMessage);
      });
    }
    this.submitError = null;
  }

  switchToConfirmMode() {
    this.confirmHarnessMode = true;
    this.currentAction = "Confirm";
    this.fireChangeTitleEvent();
  }

  isValidationError(err) {
    return err.errors.length > 0 && err.errors[0].ValidationMessages;
  }

  reportValidity = (reference, message) => {
    if (reference) {
      reference = reference.substring(1);
      if (this.componentRegistry[reference]) {
        this.componentRegistry[reference].forEach(entry => {
          const input = entry.component;
          if (input) {
            input.setCustomValidity(message);
            input.reportValidity();
          }
        });
      }
    }
  };

  get hasErrors() {
    return this.validationErrors && this.validationErrors.length > 0;
  }

  openModalDialog() {
    let modal = this.template.querySelector("c-modal-dialog");
    modal.setView(this.caseDetails);
    modal.openModal();
  }

  handleSubmit() {
    const allFieldsValid = Object.values(this.componentRegistry).reduce(
      (isValid, itms) => {
        let componentValid = true;
        itms.forEach(itm => {
          if (itm.component) {
            if (!itm.field.readOnly) {
              itm.component.setCustomValidity("");
              if (!itm.component.checkValidity())
                itm.component.reportValidity();
              componentValid = componentValid && itm.component.checkValidity();
            }
          }
        });
        return isValid && componentValid;
      },
      true
    );
    if (allFieldsValid) {
      this.handlePerformAction();
    } else {
      if (this.validationErrors.length === 0) {
        this.validationErrors.push({
          Path: "Validation errors",
          ValidationMessage: "invalid form data"
        });
      }
    }
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  handleCancel() {
    const closeEvent = new CustomEvent("workoblectclosed", {
      bubbles: true,
      detail: {
        assignmentId: this.assignmentId,
        caseId: this.caseId
      }
    });
    this.dispatchEvent(closeEvent);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  handleConfirm() {
    const closeEvent = new CustomEvent("workoblectclosed", {
      bubbles: true,
      detail: {
        assignmentId: this.assignmentId,
        caseId: this.caseId
      }
    });
    this.dispatchEvent(closeEvent);
    fireEvent(this.pageRef, "refreshAssignments");
  }

  handleClick = () => {
    const closeEvent = new CustomEvent("workoblectclosed", {
      detail: {
        assignmentId: this.assignmentId,
        caseId: this.caseId
      }
    });
    this.dispatchEvent(closeEvent);
  };

  getWorkObject = () => {
    return this.workObject;
  };

  async handleSave() {
    this.validationErrors = [];
    try {
      this.showSpinner = true;
      let postData = ReferenceHelper.getPostContent(
        this.caseData,
        this.componentRegistry
      );
      let content = { content: postData };
      await apiService.updateCase(
        this.url,
        this.caseId,
        content,
        this.workObject.etag
      );
      let workObject = await apiService.getCase(this.url, this.caseId);
      this.workObject = workObject;
      this.showSpinner = false;
      apiService.showMessage(
        "Success",
        `Work object ${this.caseId.split(" ")[1]} successfully saved`,
        this
      );
    } catch (err) {
      this.showSpinner = false;
      if (!err.errors) {
        apiService.showError(err, this);
      } else {
        err.errors.forEach(error => {
          if (error.ValidationMessages) {
            error.ValidationMessages.forEach(msg => {
              if (msg.Path) {
                this.validationErrors.push(msg);
                this.reportValidity(
                  msg.Path,
                  msg.ValidationMessage
                );
              }
            });
          } else {
            apiService.logError(new Error("invalid state"));
          }
        });
      }
    }
  }

  get key() {
    return apiService.generateKey("m");
  }
}
