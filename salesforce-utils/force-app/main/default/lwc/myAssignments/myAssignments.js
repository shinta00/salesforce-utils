import { LightningElement, track, api } from "lwc";
import { apiService } from "c/service";

export default class MyAssignments extends LightningElement {
  @api urls;
  @api worklistDataPage = "D_pyMyWorkList";
  @api defaulColumns =
    "pxRefObjectInsName, pyAssignmentStatus, pxUrgencyAssign, pyLabel, pxCreateDateTime, pxTaskLabel";
  @api workBasketDataPage = "D_WorkBasket";
  @api title;

  cardIcon = "utility:assignment";
  cardMode = "worklist";
  @track
  state = {
    mode: this.cardMode,
    assignmentId: null,
    caseId: null,
    title: this.title ? this.title : "My Assignments",
    icon: this.cardIcon,
    operator: null,
    caseUrl: null
  };

  endpoints = [];
  wlColumns;
  wbColumns =
    "pxRefObjectInsName, pyAssignmentStatus, pxUrgencyAssign, pyLabel, pxCreateDateTime";

  async init() {
    if (this.urls) {
        await apiService.initComponent(this);
        this.state.operator = await apiService.getDataPage(
          this.endpoints[0],
          "D_OperatorID"
        );
        this.template.querySelector('c-assignment-list').setOperator(this.state.operator);
    }
  }

  connectedCallback() {
    this.state.title = this.title;
    this.init();
  }

  handleWorkItemSelected(event) {
    this.state = {
      ...this.state,
      mode: "workobject",
      assignmentId: event.detail.assignmentId,
      caseId: event.detail.caseId,
      caseUrl: event.detail.caseUrl
    };
  }

  handleWorkObjectClosed() {
    this.state = {
      ...this.state,
      mode: this.cardMode,
      title: this.title,
      icon: this.cardIcon,
      assignmentId: null,
      caseId: null,
      caseUrl: null
    };
  }

  handleChangeTitle(event) {
    this.state.title = `${event.detail.caseName} - ${event.detail.caseId} - ${event.detail.action}`;
    this.state.icon = "utility:case";
    this.state = { ...this.state };
  }

  @api
  get worklistColumns() {
    if (!this.wlColumns) return this.defaulColumns;
    return this.wlColumns;
  }
  set worklistColumns(cols) {
    this.wlColumns = cols;
  }

  @api
  get workBasketColumns() {
    if (!this.wbColumns) return this.defaulColumns;
    return this.wbColumns;
  }
  set workBasketColumns(cols) {
    this.wbColumns = cols;
  }

  get isWorklist() {
    return this.state.mode === this.cardMode;
  }
}
