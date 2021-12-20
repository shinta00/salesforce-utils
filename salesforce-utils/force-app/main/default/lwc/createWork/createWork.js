import { LightningElement, track, api, wire } from "lwc";
import { apiService } from "c/service";
import { CurrentPageReference } from "lightning/navigation";
import { fireEvent } from "c/pegapubsub";

export default class CreateWork extends LightningElement {
  cardIcon = "utility:record_create";
  cardMode = "createWork";
  numberOfCols = 6;
  colSize = 2;

  @track newHarnessView;
  @track
  state = {
    mode: this.cardMode,
    assignmentId: null,
    caseId: null,
    title: this.title ? this.title : "Create Case",
    icon: this.cardIcon,
    caseUrl: null
  };

  @api urls;
  @api flows;
  @api processId;
  @api caseType;
  @api title;
  @track caseTypes = [];

  @track rows = [[]];
  @track lastRow = [];
  @track lastColSize = 1;

  endpoints = [];
  showSpinner;
  errorMessages = {};

  @wire(CurrentPageReference) pageRef;

  async init() {
    if (this.urls) {
      await apiService.initComponent(this);
      await this.getCaseTypes();
    }
  }

  connectedCallback() {
    this.state.title = this.title;
    this.init();
  }

  processCaseType(caseType, types, idx) {
    if (caseType.CanCreate === true || caseType.CanCreate === "true") {
      caseType.caseUrl = this.endpoints[idx];
      if (caseType.startingProcesses && caseType.startingProcesses.length > 0) {
        if (caseType.startingProcesses[0].name) caseType.name = caseType.startingProcesses[0].name;
      }
      types.push(caseType);
    }
  }

  async getCaseTypes() {
    let types = [];
    const caseTypesPromiseList = this.endpoints.map(itm => apiService.getCaseTypes(itm));
    const caseTypesPromiseResultList = await Promise.allSettled(caseTypesPromiseList);
    caseTypesPromiseResultList.forEach((itm, idx) => {
      if (itm.status === "fulfilled") {
        let currentTypes = itm.value;
        if (currentTypes && currentTypes.caseTypes) {
          currentTypes.caseTypes.forEach(caseType => this.processCaseType(caseType, types, idx));
        }
      } else {
        this.errorMessages[this.endpoints[idx]] = `${
          this.endpoints[idx].split(/\//)[2]
        } is not responsing, please contact your system administrator.`;
        apiService.logError(itm.reason);
      }
    });

    let flows = [];
    if (types.length > 0) {
      if (this.flows) {
        this.flows = this.flows.toUpperCase();
        flows = this.flows.split(/\s*,\s*/);
        types = types.filter(
          caseType => !this.flows || flows.includes(caseType.name.toUpperCase())
        );
      }
      const types2D = [];
      types.forEach((type, idx) => {
        if (idx % this.numberOfCols === 0) types2D.push([]);
        types2D[types2D.length - 1].push(type);
      });
      this.caseTypes = types;

      if (types2D.length > 1) {
        this.rows = types2D.slice(0, types2D.length - 1);
      } else {
        this.rows = types2D;
      }
      if (types2D.length > 1 && types2D[types2D.length - 1].length !== this.numberOfCols) {
        let lastRow = types2D.slice(types2D.length - 1)[0];
        this.lastRow = lastRow;
      }
    }
  }

  get hasErrors() {
    return this.errorMessages && Object.keys(this.errorMessages).length > 0;
  }

  get errors() {
    let errors = [];
    Object.keys(this.errorMessages).forEach(k => {
      errors.push(this.errorMessages[k]);
    });
    return errors;
  }

  hideErrors = event => {
    event.preventDefault();
    this.urls = this.urls
      .split(/\s*,\s*/)
      .filter(itm => this.errorMessages[itm] === null)
      .join(",");
    this.errorMessages = {};
  };

  handleClick(evt) {
    this.state.assignmentId = null;
    this.state.caseId = null;
    this.errorMessages = {};
    let idx = evt.target.dataset.index;
    let caseType = this.caseTypes[idx];
    this.state.caseUrl = caseType.caseUrl;
    if (caseType.startingProcesses && caseType.startingProcesses.length > 0 &&
      (caseType.startingProcesses[0].requiresFieldsToCreate === true || 
       caseType.startingProcesses[0].requiresFieldsToCreate === "true")
    ) {
      this.showNewHarness(caseType);
    } else {
      this.createCase(caseType);
    }
  }

  async showNewHarness(caseType) {
    this.showSpinner = true;
    try {
      let newHarness = await apiService.getCaseTypeDetails(
        caseType.caseUrl,
        caseType.ID
      );
      newHarness.creation_page.visible = true;
      this.newHarnessView = newHarness.creation_page;
      this.state.mode = "newharness";
      this.caseType = caseType.ID;
      this.processId = caseType.startingProcesses[0].ID ? caseType.startingProcesses[0].ID : "pyStartCase";
      this.showSpinner = false;
    } catch (err) {
      apiService.logError(err);
      if (
        err &&
        err.errors &&
        err.errors.length > 0 &&
        err.errors[0].ID === "Pega_API_023"
      ) {
        apiService.showMessage(
          "No Assignments",
          err.errors[0].message,
          this,
          "info"
        );
      } else {
        apiService.showError(err, this);
      }
    }
    this.showSpinner = false;
  }

  async createCase(caseType) {
    this.showSpinner = true;
    try {
      let content = {};
      let body = {
        caseTypeID: caseType.ID,
        content
      };

      if (caseType.startingProcesses && 
        caseType.startingProcesses.length > 0 && caseType.startingProcesses[0].ID) {
        body.processID = caseType.startingProcesses[0].ID;
      } else {
        body.processID = "";
      }
      let newCase = await apiService.createCase(caseType.caseUrl, body);
      if (newCase.nextAssignmentID) {
        this.state.assignmentId = newCase.nextAssignmentID;
        this.state.caseId = newCase.ID;
        this.state.mode = "workobject";
        fireEvent(this.pageRef, "workObjectCreated", newCase.ID);
      } else {
        apiService.showMessage("Case created", `Case created`, this, "info");
      }
    } catch (err) {
      apiService.logError(err);
      if (
        err &&
        err.errors &&
        err.errors.length > 0 &&
        err.errors[0].ID === "Pega_API_023"
      ) {
        apiService.showMessage(
          "No Assignments",
          err.errors[0].message,
          this,
          "info"
        );
      } else {
        apiService.showError(err, this);
      }
    }
    this.showSpinner = false;
  }

  handleWorkObjectClosed() {
    this.state.mode = this.cardMode;
    this.state.title = this.title;
    this.state.icon = this.cardIcon;
    this.state.assignmentId = null;
    this.state.caseId = null;
  }

  handleChangeTitle(event) {
    this.state.title = `${event.detail.caseName} - ${event.detail.caseId} - ${event.detail.action}`;
    this.state.icon = "utility:case";
  }

  get isCreateWork() {
    return this.state.mode === this.cardMode;
  }

  get keyRow() {
    return apiService.generateKey("tr");
  }

  get key() {
    return apiService.generateKey("k");
  }
}
