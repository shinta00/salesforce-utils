import { LightningElement, track, api, wire } from "lwc";
import { apiService } from "c/service";
import { registerListener, unregisterAllListeners } from "c/pegapubsub";
import { CurrentPageReference } from "lightning/navigation";

export default class AssignmentList extends LightningElement {
  workLisyKW = "My Worklist";
  @api operator;

  @api worklistDataPage;
  @api workBasketDataPage;
  @api flexipageRegionWidth;
  _worklistColumns = [
    "pxRefObjectInsName",
    "pyAssignmentStatus",
    "pxUrgencyAssign",
    "pyLabel",
    "pxCreateDateTime",
    "pxTaskLabel"
  ];
  _workbasketColumns = [
    "pxRefObjectInsName",
    "pyAssignmentStatus",
    "pxUrgencyAssign",
    "pyLabel",
    "pxCreateDateTime"
  ];
  requiredOptions = ["pxRefObjectInsName"];
  @track availableWorklistColumnsOptions = [];
  selectedOptions;
  @track assignments = [];
  @track tableLoadingState = true;
  @track currentAssignmentSource = this.workLisyKW;
  @track sortDirection = "desc";
  @track queryTerm = "";
  @track fetchTime = new Date();

  @wire(CurrentPageReference) pageRef;
  sortByOptions = [];
  sortedBy = "pxRefObjectInsName";
  @track columns;
  assignmentSource;
  assignmentsData = [];
  currentIndex = 0;
  pageSize = 10;
  errorMessages = {};
  headersMap = {};
  assignmentsRD;
  dateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  };
  dateFormat = new Intl.DateTimeFormat("en", this.dateTimeFormatOptions);
  settingsHeader = "My Assignments Settings";

  connectedCallback() {
    registerListener("workObjectCreated", this.handleRefresh, this);
    registerListener("refreshAssignments", this.handleRefresh, this);
    if (this.operator) this.init();
  }

  get sortDirectionOptions() {
    return [
      { label: "Ascending", value: "asc" },
      { label: "Descending", value: "desc" }
    ];
  }

  @api
  async setOperator(operator) {
    this.operator = operator;
    this.init();
  }

  async init() {
    await this.processAssignmentsSource();
    this.getAssignments();
  }

  disconnectedCallback() {
    unregisterAllListeners(this);
  }

  isDate(name, value) {
    if (value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
      return true;
    if (
      name &&
      name.toLowerCase().includes("date") &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    )
      return true;
    return false;
  }
 
  createHeader(useSavedHeaders=true) {
    let columnsSource;
    if (this.currentAssignmentSource === this.workLisyKW) {
      let savedColumns;
      let settingsStr = window.localStorage.getItem("worklistSettings");
      if (useSavedHeaders && settingsStr) {
        let settings = JSON.parse(settingsStr);
        savedColumns = settings.worklistColumns;
        this.sortedBy = this.headersMap[settings.sortedBy]
          ? settings.sortedBy
          : this.sortedBy;
        this.sortDirection = settings.sortDirection;
        this.pageSize = settings.pageSize;
      }
      if (savedColumns) {
        columnsSource = savedColumns.split(",").filter(col => {
          if (this.headersMap[col]) return true;
          return false;
        });
        this._worklistColumns = columnsSource;
      } else {
        columnsSource = this.defaultWorklistColumns;
      }
    } else {
      columnsSource = this.defaultWorkbasketColumns;
    }

    let columnsArray = columnsSource.map(col => {
      let column = {
        label: this.headersMap[col],
        fieldName: col,
        sortable: true
      };
      if (this.assignmentsData.length > 0) {
        let value = this.assignmentsData[0][col];
        if (this.isDate(col, value)) {
          column.type = "date";
          column.typeAttributes = this.dateTimeFormatOptions;
        }
      }
      if (col === "pxUrgencyAssign") column.fixedWidth = 120;
      else if (col === "pxRefObjectInsName") column.fixedWidth = 90;
      else if (col === "pyAssignmentStatus") column.fixedWidth = 150;
      else if (col === "pyLabel") column.fixedWidth = 150;

      return column;
    });
    this.columns = columnsArray;
    if (!columnsSource.includes("pxRefObjectInsName")) {
      this.columns.push({
        label: "Case ID",
        fieldName: "pxRefObjectInsName",
        sortable: true
      });
    }
    this.setAvailableWorklistColumnsOptions();
    this.setSortByOptionsOptions();
  }
   
  async getOtherWorkBaskets() {
    let otherWorkBaskets = [];
    
    const workbasketPromiseList = this.endpoints.map(itm => apiService.getDataPage(itm, "D_OperatorID"));
    const workbasketPromiseResultList = await Promise.allSettled(workbasketPromiseList);
    workbasketPromiseResultList.forEach((itm, i) => {
      if (i > 0) {
        if (itm.status === "fulfilled") {
          const operator = itm.value;
          if (operator.pyWorkbasket && operator.pyWorkbasket.length > 0) {
            operator.pyWorkbasket.forEach((basket, idx) => {
              otherWorkBaskets.push({
                label: basket,
                value: basket,
                key: 10 ** i + idx,
                url: this.urls[i]
              });
            });
          }
        } else {
          this.errorMessages[this.endpoints[i]] = `${this.endpoints[i].split(/\//)[2]
            } is not responsing, please contact your system administrator.`;
        }
      }
    });

    return otherWorkBaskets;
  }

  async processAssignmentsSource() {
    let otherWorkBaskets = await this.getOtherWorkBaskets();
    let sources = [this.workLisyKW, ...this.operator.pyWorkbasket];
    let assignmentSource = sources.map((option, idx) => {
      return {
        label: option,
        value: option,
        key: idx,
        url: this.urls[0]
      };
    });
    this.assignmentSource = [...assignmentSource, ...otherWorkBaskets];
  }

  buildHeaders(assignmentsRD) {
    this.assignmentsRD = assignmentsRD;
    assignmentsRD.pyReportDefinition.pyContent.pyFields.pyListFields.forEach(
      itm => {
        const name = itm.pyFieldName.replace(".", "");
        this.headersMap[name] = itm.pyFieldLabel;
      }
    );
  }

  async getWorkListAssignments() {
    let allAssignments = [];

    const woorkListPromise = this.urls.map(itm => apiService.getWorkList(
      itm,
      this.worklistDataPage
    ));
    const woorkListPromiseResult = await Promise.allSettled(woorkListPromise);
    woorkListPromiseResult.forEach((itm, i) => {
      try {
        if (itm.status === "fulfilled") {
          const assignmentsData = itm.value;
          if (assignmentsData.pxResults && assignmentsData.pxResults.length > 0) {
            assignmentsData.pxResults.forEach(assignment => {
              assignment.caseUrl = this.urls[i];
            });
            this.buildHeaders(assignmentsData);
            allAssignments = [...allAssignments, ...assignmentsData.pxResults];
          }
        } else {
          this.errorMessages[this.urls[i]] = `${this.urls[i].split(/\//)[2]
            } is not responsing, please contact your system administrator.`;
        }
      } catch (error) {
        apiService.logError(error);
      }
    });
    this.tableLoadingState = false;
    return allAssignments;
  }

  async getWorkBasketAssignments() {
    let workBasketAssignments = [];
    let source = this.assignmentSource.filter(
      itm => itm.value === this.currentAssignmentSource
    );
    try {
      let allAssignments = await apiService.getWorkBasket(
        source[0].url,
        this.currentAssignmentSource
      );
      if (allAssignments.pxResults && allAssignments.pxResults.length > 0) {
        allAssignments.pxResults.forEach(assignment => {
          assignment.caseUrl = source[0].url;
        });
        workBasketAssignments = allAssignments.pxResults;
      }
    } catch (err) {
      apiService.logError(err);
      this.errorMessages[
        source[0].url
      ] = `Couldn't get assignments from ${source[0].url}`;
    }
    return workBasketAssignments;
  }

  async getAssignments() {
    try {
      this.tableLoadingState = true;
      this.assignments = [];
      this.fetchTime = new Date();
      this.assignmentsData =
        this.currentAssignmentSource === this.workLisyKW
          ? await this.getWorkListAssignments()
          : await this.getWorkBasketAssignments();
      this.createHeader();
      this.loadData();
      this.tableLoadingState = false;
    } catch (error) {
      this.tableLoadingState = false;
      apiService.showError(error, this);
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
      .filter(itm => this.errorMessages[itm] == null)
      .join(",");
    this.errorMessages = {};
  };

  @api
  set urls(urls) {
    this.endpoints = urls.split(/\s*,\s*/);
  }

  get urls() {
    return this.endpoints;
  }

  doGetAssignments = () => {
    this.getAssignments();
  };

  handleRefresh() {
    this.currentIndex = 0;
    this.queryTerm = "";
    this.doGetAssignments();
  }

  handleWorkSourceChange(event) {
    try {
      this.currentIndex = 0;
      this.currentAssignmentSource = event.detail.value;
      this.queryTerm = "";
      this.getAssignments();
    } catch (error) {
      apiService.logError(error);
      apiService.showError(error, this);
    }
  }

  handleSort(event) {
    let sortedBy = event.detail.fieldName;
    if (sortedBy) {
      if (sortedBy === this.sortedBy) {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      }
      this.sortedBy = sortedBy;
    }

    this.loadData();
  }

  handleKeyUp(evt) {
    this.queryTerm = evt.target.value;
    this.currentIndex = 0;
    apiService.debounce(this.loadData, 100)();
  }

  handleSearch(evt) {
    this.queryTerm = evt.target.value;
    this.currentIndex = 0;
    this.loadData();
  }

  handleRowSelection(event) {
    const selectedRows = event.detail.selectedRows;
    if (selectedRows.length === 0) return;
    const assignmentId = selectedRows[0].pzInsKey;
    const caseUrl = selectedRows[0].caseUrl;
    const caseId = selectedRows[0].pxRefObjectKey;
    const selectEvent = new CustomEvent("workitemselected", {
      detail: {
        assignmentId,
        caseId,
        caseUrl
      }
    });
    this.dispatchEvent(selectEvent);
  }

  get assignmentsFetchTime() {
    let time = this.fetchTime.toLocaleTimeString().replace(/:\d{2} /, " ");
    return `${this.assignments.length} of ${this.total} assignments as of today ${time}`;
  }

  get showAssignmentSource() {
    return this.assignmentSource && this.assignmentSource.length > 1;
  }

  processSearch(value, matchMap, queryTerms) {
    for (let i = 0; i < queryTerms.length; i++) {
      if (queryTerms[i] && value.toLowerCase().includes(queryTerms[i])) {
        matchMap[queryTerms[i]] = true;
      }
    }
  }

  loadData = () => {
    let moreAssignments = [...this.assignmentsData];
    if (this.queryTerm) {
      const queryTerms = this.queryTerm
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term);
      moreAssignments = moreAssignments.filter(itm => {
        let matchMap = {};
        for (let i = 0; i < this.columns.length; i++) {
          let value = itm[this.columns[i].fieldName];
          if (!value) continue;
          if (this.isDate(this.columns[i].fieldName, value)) {
            value = this.dateFormat.format(Date.parse(value));
          }
          this.processSearch(value, matchMap, queryTerms);
        }
        return queryTerms.reduce((v, key) => v && matchMap[key], true);
      });
    }

    if (this.sortedBy === "pxRefObjectInsName") {
      moreAssignments.sort((x, y) => {
        const prefixX = x.pxRefObjectInsName.split("-");
        const prefixY = y.pxRefObjectInsName.split("-");
        if (prefixX[0] !== prefixY[0]) {
          if (prefixX[0] < prefixY[0]) return -1;
          if (prefixX[0] > prefixY[0]) return 1;
          return 0;
        }
        return prefixX[1] - prefixY[1];
      });
    } else if (
      moreAssignments.length > 0 &&
      this.isDate(moreAssignments[0][this.sortedBy])
    ) {
      moreAssignments.sort((x, y) => {
        let v0 = x[this.sortedBy];
        let v1 = y[this.sortedBy];
        return new Date(v0).localeCompare(Date(v1));
      });
    } else {
      moreAssignments.sort((x, y) => {
        let v0 = x[this.sortedBy];
        let v1 = y[this.sortedBy];
        v0 = typeof v0 === "string" ? v0.toUpperCase() : v0;
        v1 = typeof v1 === "string" ? v1.toUpperCase() : v1;
        if (!v0 || v0 < v1) return -1;
        if (!v1 || v0 > v1) return 1;
        return 0;
      });
    }

    if (this.sortDirection === "desc") {
      moreAssignments.reverse();
    }

    this.total = moreAssignments.length;
    let lastIdx = this.pageSize * this.currentIndex;
    if (lastIdx < moreAssignments.length) {
      this.currentIndex++;
      lastIdx = this.pageSize * this.currentIndex;
      moreAssignments = moreAssignments.slice(0, lastIdx);
      this.assignments = moreAssignments.map(itm => {
        let pxCreateDateTime = itm.pxCreateDateTime.replace(/ GMT/, " Z");
        pxCreateDateTime = new Date(pxCreateDateTime);
        let x = { ...itm, pxCreateDateTime };
        return x;
      });
    } else {
      this.assignments = moreAssignments;
    }
  };

  loadMoreData() {
    apiService.debounce(this.loadData, 300)();
  }

  @api
  set defaultWorkbasketColumns(cols) {
    if (cols && cols.length > 0)
      this._workbasketColumns = cols.split(/\s*,\s*/);
  }

  get defaultWorkbasketColumns() {
    if (!this._workbasketColumns) return [];
    return this._workbasketColumns;
  }

  @api
  set defaultWorklistColumns(cols) {
    if (cols) this._worklistColumns = cols.split(/\s*,\s*/);
  }

  get defaultWorklistColumns() {
    if (!this._worklistColumns) return [];
    return this._worklistColumns;
  }

  setAvailableWorklistColumnsOptions() {
    this.availableWorklistColumnsOptions = [];
    Object.keys(this.headersMap).forEach(key => {
      this.availableWorklistColumnsOptions.push({
        label: this.headersMap[key],
        value: key,
        key: key
      });
    });
  }

  get currentSortColumn() {
    return this.sortedBy;
  }

  setSortByOptionsOptions() {
    this.sortByOptions = [];
    this._worklistColumns.forEach(key => {
      this.sortByOptions.push({
        label: this.headersMap[key],
        value: key,
        key: key
      });
    });
  }

  handleSelectColumnChange(evt) {
    this._worklistColumns = evt.target.value;
    this.createHeader(false);
  }

  handleSortByColumn(evt) {
    this.sortedBy = evt.target.value;
    this.handleSort(evt);
  }

  handleSortDirection(evt) {
    this.sortDirection = evt.target.value;
    this.handleSort(evt);
  }

  handleCloseSettings() {
    const settings = {
      sortedBy: this.sortedBy,
      sortDirection: this.sortDirection,
      pageSize: this.pageSize,
      worklistColumns: this._worklistColumns.join(",")
    };
    window.localStorage.setItem("worklistSettings", JSON.stringify(settings));

    const modal = this.template.querySelector("c-modal");
    modal.hide();
  }

  handleShowSettings() {
    const modal = this.template.querySelector("c-modal");
    modal.show();
  }

  handlePageSize(evt) {
    this.pageSize = evt.target.value;
  }

  handleWorklistDataPage(evt) {
    this.worklistDataPage = evt.target.value;
  }

  handleWorkbasketDataPage(evt) {
    this.workBasketDataPage = evt.target.value;
  }
}
