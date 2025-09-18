import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_STUDENT = 300;
const ERR_SESSION_EXISTS = 301;
const ERR_NOT_AUTHORIZED = 302;
const ERR_SESSION_NOT_FOUND = 303;
const ERR_SESSION_NOT_ACTIVE = 304;
const ERR_INVALID_TEST = 305;
const ERR_INVALID_START_TIME = 306;
const ERR_INVALID_END_TIME = 307;
const ERR_INVALID_STATUS = 308;
const ERR_INVALID_ATTEMPTS = 309;
const ERR_INVALID_PROCTOR_SCORE = 310;
const ERR_MAX_ATTEMPTS_EXCEEDED = 311;
const ERR_SESSION_UPDATE_NOT_ALLOWED = 312;
const ERR_INVALID_UPDATE_PARAM = 313;
const ERR_MAX_SESSIONS_EXCEEDED = 314;
const ERR_INVALID_PROCTOR = 315;
const ERR_INVALID_DURATION = 316;
const ERR_INVALID_LOCATION = 317;
const ERR_INVALID_DEVICE = 318;
const ERR_INVALID_VERIFICATION = 319;
const ERR_AUTHORITY_NOT_VERIFIED = 320;
const ERR_INVALID_MIN_SCORE = 321;
const ERR_INVALID_MAX_DURATION = 322;

interface Session {
  student: string;
  testId: number;
  startTime: number;
  endTime: number | null;
  active: boolean;
  attempts: number;
  proctorScore: number;
  status: string;
  proctor: string;
  duration: number;
  location: string;
  device: string;
  verification: boolean;
  minScore: number;
  maxDuration: number;
}

interface SessionUpdate {
  updateStartTime: number;
  updateEndTime: number | null;
  updateAttempts: number;
  updateProctorScore: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ExamSessionMock {
  state: {
    nextSessionId: number;
    maxSessions: number;
    sessionFee: number;
    authorityContract: string | null;
    maxAttempts: number;
    minProctorScore: number;
    sessions: Map<number, Session>;
    sessionUpdates: Map<number, SessionUpdate>;
    sessionsByStudentTest: Map<string, number>;
  } = {
    nextSessionId: 0,
    maxSessions: 10000,
    sessionFee: 500,
    authorityContract: null,
    maxAttempts: 3,
    minProctorScore: 70,
    sessions: new Map(),
    sessionUpdates: new Map(),
    sessionsByStudentTest: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  userRoles: Map<string, string> = new Map([["ST1TEST", "student"], ["ST2PROCTOR", "proctor"]]);
  tests: Map<number, { exists: boolean }> = new Map([[1, { exists: true }]]);

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextSessionId: 0,
      maxSessions: 10000,
      sessionFee: 500,
      authorityContract: null,
      maxAttempts: 3,
      minProctorScore: 70,
      sessions: new Map(),
      sessionUpdates: new Map(),
      sessionsByStudentTest: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.userRoles = new Map([["ST1TEST", "student"], ["ST2PROCTOR", "proctor"]]);
    this.tests = new Map([[1, { exists: true }]]);
  }

  getUserRole(principal: string): Result<string> {
    const role = this.userRoles.get(principal);
    return role ? { ok: true, value: role } : { ok: false, value: "" };
  }

  getTest(testId: number): Result<{ exists: boolean }> {
    const test = this.tests.get(testId);
    return test ? { ok: true, value: test } : { ok: false, value: { exists: false } };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSessionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.sessionFee = newFee;
    return { ok: true, value: true };
  }

  setMaxAttempts(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxAttempts = newMax;
    return { ok: true, value: true };
  }

  setMinProctorScore(newMin: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.minProctorScore = newMin;
    return { ok: true, value: true };
  }

  startSession(
    testId: number,
    student: string,
    proctor: string,
    duration: number,
    location: string,
    device: string,
    minScore: number,
    maxDuration: number
  ): Result<number> {
    if (this.state.nextSessionId >= this.state.maxSessions) return { ok: false, value: ERR_MAX_SESSIONS_EXCEEDED };
    if (this.caller !== student) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.getUserRole(student).value !== "student") return { ok: false, value: ERR_NOT_STUDENT };
    if (!this.getTest(testId).value.exists) return { ok: false, value: ERR_INVALID_TEST };
    if (this.getUserRole(proctor).value !== "proctor") return { ok: false, value: ERR_INVALID_PROCTOR };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!device || device.length > 50) return { ok: false, value: ERR_INVALID_DEVICE };
    if (minScore <= 0 || minScore > 100) return { ok: false, value: ERR_INVALID_MIN_SCORE };
    if (maxDuration <= 0) return { ok: false, value: ERR_INVALID_MAX_DURATION };
    const key = `${student}-${testId}`;
    if (this.state.sessionsByStudentTest.has(key)) return { ok: false, value: ERR_SESSION_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.sessionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextSessionId;
    const session: Session = {
      student,
      testId,
      startTime: this.blockHeight,
      endTime: null,
      active: true,
      attempts: 1,
      proctorScore: 0,
      status: "active",
      proctor,
      duration,
      location,
      device,
      verification: false,
      minScore,
      maxDuration,
    };
    this.state.sessions.set(id, session);
    this.state.sessionsByStudentTest.set(key, id);
    this.state.nextSessionId++;
    return { ok: true, value: id };
  }

  getSession(id: number): Session | null {
    return this.state.sessions.get(id) || null;
  }

  endSession(id: number): Result<boolean> {
    const session = this.state.sessions.get(id);
    if (!session) return { ok: false, value: false };
    if (session.student !== this.caller) return { ok: false, value: false };
    if (!session.active) return { ok: false, value: false };
    if (this.blockHeight - session.startTime > session.maxDuration) return { ok: false, value: false };
    const updated: Session = {
      ...session,
      endTime: this.blockHeight,
      active: false,
      status: "completed",
    };
    this.state.sessions.set(id, updated);
    return { ok: true, value: true };
  }

  updateSession(id: number, updateAttempts: number, updateProctorScore: number): Result<boolean> {
    const session = this.state.sessions.get(id);
    if (!session) return { ok: false, value: false };
    if (session.proctor !== this.caller) return { ok: false, value: false };
    if (updateAttempts <= 0 || updateAttempts > this.state.maxAttempts) return { ok: false, value: false };
    if (updateProctorScore < this.state.minProctorScore || updateProctorScore > 100) return { ok: false, value: false };
    if (updateAttempts > this.state.maxAttempts) return { ok: false, value: false };
    const updated: Session = {
      ...session,
      attempts: updateAttempts,
      proctorScore: updateProctorScore,
      verification: updateProctorScore >= session.minScore,
    };
    this.state.sessions.set(id, updated);
    this.state.sessionUpdates.set(id, {
      updateStartTime: session.startTime,
      updateEndTime: session.endTime,
      updateAttempts,
      updateProctorScore,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  retrySession(id: number): Result<boolean> {
    const session = this.state.sessions.get(id);
    if (!session) return { ok: false, value: false };
    if (session.student !== this.caller) return { ok: false, value: false };
    if (session.active) return { ok: false, value: false };
    if (session.attempts >= this.state.maxAttempts) return { ok: false, value: false };
    const updated: Session = {
      ...session,
      startTime: this.blockHeight,
      endTime: null,
      active: true,
      attempts: session.attempts + 1,
      status: "active",
    };
    this.state.sessions.set(id, updated);
    return { ok: true, value: true };
  }

  verifySession(id: number): Result<boolean> {
    const session = this.state.sessions.get(id);
    if (!session) return { ok: false, value: false };
    if (session.proctor !== this.caller) return { ok: false, value: false };
    if (session.active) return { ok: false, value: false };
    if (session.proctorScore < session.minScore) return { ok: false, value: false };
    const updated: Session = {
      ...session,
      verification: true,
    };
    this.state.sessions.set(id, updated);
    return { ok: true, value: true };
  }

  getSessionCount(): Result<number> {
    return { ok: true, value: this.state.nextSessionId };
  }

  checkSessionExistence(student: string, testId: number): Result<boolean> {
    const key = `${student}-${testId}`;
    return { ok: true, value: this.state.sessionsByStudentTest.has(key) };
  }
}

describe("ExamSession", () => {
  let contract: ExamSessionMock;

  beforeEach(() => {
    contract = new ExamSessionMock();
    contract.reset();
  });

  it("starts a session successfully", () => {
    contract.setAuthorityContract("ST3AUTH");
    const result = contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const session = contract.getSession(0);
    expect(session?.student).toBe("ST1TEST");
    expect(session?.testId).toBe(1);
    expect(session?.proctor).toBe("ST2PROCTOR");
    expect(session?.duration).toBe(60);
    expect(session?.location).toBe("LocationA");
    expect(session?.device).toBe("DeviceX");
    expect(session?.minScore).toBe(70);
    expect(session?.maxDuration).toBe(120);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST3AUTH" }]);
  });

  it("rejects duplicate sessions", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    const result = contract.startSession(1, "ST1TEST", "ST2PROCTOR", 90, "LocationB", "DeviceY", 80, 180);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SESSION_EXISTS);
  });

  it("rejects non-student caller", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.userRoles.set("ST1TEST", "other");
    const result = contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_STUDENT);
  });

  it("rejects session start without authority contract", () => {
    const result = contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid test", () => {
    contract.setAuthorityContract("ST3AUTH");
    const result = contract.startSession(99, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TEST);
  });

  it("rejects invalid proctor", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.userRoles.set("ST2PROCTOR", "other");
    const result = contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROCTOR);
  });

  it("ends a session successfully", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.blockHeight = 50;
    const result = contract.endSession(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const session = contract.getSession(0);
    expect(session?.endTime).toBe(50);
    expect(session?.active).toBe(false);
    expect(session?.status).toBe("completed");
  });

  it("rejects end for non-existent session", () => {
    contract.setAuthorityContract("ST3AUTH");
    const result = contract.endSession(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects end by non-student", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.caller = "ST3FAKE";
    const result = contract.endSession(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates a session successfully", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.caller = "ST2PROCTOR";
    contract.blockHeight = 50;
    const result = contract.updateSession(0, 2, 85);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const session = contract.getSession(0);
    expect(session?.attempts).toBe(2);
    expect(session?.proctorScore).toBe(85);
    expect(session?.verification).toBe(true);
    const update = contract.state.sessionUpdates.get(0);
    expect(update?.updateAttempts).toBe(2);
    expect(update?.updateProctorScore).toBe(85);
    expect(update?.updater).toBe("ST2PROCTOR");
  });

  it("rejects update for non-existent session", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.caller = "ST2PROCTOR";
    const result = contract.updateSession(99, 2, 85);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-proctor", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.caller = "ST3FAKE";
    const result = contract.updateSession(0, 2, 85);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("retries a session successfully", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.endSession(0);
    contract.blockHeight = 100;
    const result = contract.retrySession(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const session = contract.getSession(0);
    expect(session?.startTime).toBe(100);
    expect(session?.endTime).toBe(null);
    expect(session?.active).toBe(true);
    expect(session?.attempts).toBe(2);
    expect(session?.status).toBe("active");
  });

  it("rejects retry for active session", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    const result = contract.retrySession(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects retry after max attempts", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.endSession(0);
    contract.retrySession(0);
    contract.endSession(0);
    contract.retrySession(0);
    contract.endSession(0);
    const result = contract.retrySession(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("verifies a session successfully", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.endSession(0);
    contract.caller = "ST2PROCTOR";
    contract.updateSession(0, 1, 80);
    const result = contract.verifySession(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const session = contract.getSession(0);
    expect(session?.verification).toBe(true);
  });

  it("rejects verification for active session", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.caller = "ST2PROCTOR";
    const result = contract.verifySession(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects verification with low score", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    contract.endSession(0);
    contract.caller = "ST2PROCTOR";
    contract.updateSession(0, 1, 60);
    const result = contract.verifySession(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets session fee successfully", () => {
    contract.setAuthorityContract("ST3AUTH");
    const result = contract.setSessionFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.sessionFee).toBe(1000);
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST3AUTH" }]);
  });

  it("rejects session fee change without authority", () => {
    const result = contract.setSessionFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("checks session existence correctly", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    const result = contract.checkSessionExistence("ST1TEST", 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkSessionExistence("ST1TEST", 99);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses session parameters with Clarity types", () => {
    const status = stringAsciiCV("active");
    const attempts = uintCV(2);
    expect(status.value).toBe("active");
    expect(attempts.value).toEqual(BigInt(2));
  });

  it("rejects session start with max sessions exceeded", () => {
    contract.setAuthorityContract("ST3AUTH");
    contract.state.maxSessions = 1;
    contract.startSession(1, "ST1TEST", "ST2PROCTOR", 60, "LocationA", "DeviceX", 70, 120);
    const result = contract.startSession(2, "ST1TEST", "ST2PROCTOR", 90, "LocationB", "DeviceY", 80, 180);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_SESSIONS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST3AUTH");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST3AUTH");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});