import { LightningElement, track, api } from "lwc";
import { apiService } from "c/service";

export default class GetNextWork extends LightningElement {
  @api url;
  @api title;

  cardIcon = "utility:case";
  cardMode = "nextWork";
  @track
  state = {
    mode: this.cardMode,
    assignmentId: null,
    caseId: null,
    title: this.title ? this.title : "Get Next Work",
    icon: this.cardIcon,
  };
  showSpinner;

  async init() {
    if (this.url) {
      await apiService.initComponent(this);
    }
  }

  connectedCallback() {
    this.state.title = this.title;
    this.init();
  }

  async handleClick() {
    this.showSpinner = true;
    try {
      let nextAssignment = await apiService.getNextAssignment(this.url);
      if (nextAssignment && nextAssignment.ID) {
        this.state.assignmentId = nextAssignment.ID;
        this.state.caseId = nextAssignment.caseID;
        this.state.mode = "workobject";
      }
    } catch (err) {
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
  }

  handleChangeTitle(event) {
    this.state.title = `${event.detail.caseName} - ${event.detail.caseId} - ${event.detail.action}`;
    this.state.icon = "utility:case";
  }

  get isNextWork() {
    return this.state.mode === this.cardMode;
  }
}
