import { UserAgent } from "sip.js";
import { SimpleUser } from "sip.js/lib/platform/web";

navigator.permissions.query({ name: "microphone" }).then((permissionStatus) => {
  if (permissionStatus.state === "granted") return;
  navigator.mediaDevices.getUserMedia({ audio: true });
});

const _ = (selector) => document.querySelector(selector);
const __ = (selector) => document.querySelectorAll(selector);

const connectButton = _("#connect");

const domainInput = _("#domain");
const extensionInput = _("#extension");
const passwordInput = _("#password");
const targetInput = _("#target");
const transferInput = _("#transferTarget");

const callButton = _("#call");
const hangupButton = _("#hangup");
const disconnectButton = _("#disconnect");
const transferButton = _("#transfer");

const audioElement = _("#remoteAudio");
const keypad = Array.from(__(".keypad"));
const callControls = _("#callControls");
const dtmfSpan = _("#dtmf");
const stateHolder = _("#stateHolder");
const stateSpan = _("#state");
const callStateSpan = _("#callState");

const holdCheckbox = _("#hold");
const muteCheckbox = _("#mute");

const incomingDialog = _("#incomingCallDialog");
const incomingCloseButton = _("#closeDialog");
const incomingNumber = _("#number");
const incomingAnswerButton = _("#answerCall");
const incomingDeclineButton = _("#declineCall");

let simpleUser; // SimpleUser instance
let hangupTimeout;

const Config = {
  domain, // Server domain
  extension, // Extension number
  password, // Extension password
  target, // Destination URI
  transferTarget, // Destination URI to transfer call to
};

// Bind inputs to it's config properties
for (const [param, input] of Object.entries(Config)) {
  Config[param] = input.value;

  input.addEventListener("change", (e) => {
    Config[param] = e.target.value;
  });
}

// Name for demo user
const DisplayName = `${Config.extension}@${Config.domain}`;

// SimpleUser delegate
const EventDelegate = {
  onServerConnect: () => {
    simpleUser.register().catch((error) => {
      console.error(`[${simpleUser.id}] failed to register`);
      console.error(error);
      alert("Failed to connect.\n" + error);
    });

    setClientState(ClientState.connected);
    disable([callButton, targetInput, hangupButton]);
    disable(disconnectButton, false);
  },
  onServerDisconnect: () => {
    setClientState(ClientState.disconnected);
    connectDisabled(false);
    disable([disconnectButton, callButton, targetInput, hangupButton]);
  },
  onRegistered: () => {
    setClientState(ClientState.registered);
    connectDisabled();
    disable([disconnectButton, callButton, targetInput], false);
    disable(hangupButton);
  },
  onUnregistered: () => {
    setClientState(ClientState.unregistered);
  },
  onCallCreated: () => {
    disable(callButton);
    disable(hangupButton, false);
    setCallState(CallState.calling);
    clearTimeout(hangupTimeout);
    display(stateHolder, "inline");
  },
  onCallAnswered: () => {
    callControlsDisabled(false);
    setCallState(CallState.answered);
    incomingDialog.close();
  },
  onCallHangup: () => {
    disable([callButton, targetInput], false);
    disable(hangupButton);
    callControlsDisabled();
    setCallState(CallState.finished);
    incomingDialog.close();
    hangupTimeout = setTimeout(() => {
      display(stateHolder, false);
    }, 2000);
  },
  onCallHold: (held) => {
    checked(holdCheckbox, held);
    setCallState(held ? CallState.hold : CallState.answered);
  },
  onCallReceived: (call) => {
    const { remoteIdentity } = simpleUser.session;
    const number = remoteIdentity?.uri.normal.user;
    const name = remoteIdentity?.displayName;
    showIncomingCall(`${name ? `(${name}): ` : ""}${number}`);
  },
};

const CallState = {
  finished: "Finished",
  answered: "Answered",
  calling: "Calling",
  hold: "Held",
};

const ClientState = {
  connected: "Connected",
  disconnected: "Disconnected",
  registered: "Registered (Ready to Make/Receive calls)",
  unregistered: "Unregistered",
};

const transferCall = (number) => {
  const uri = UserAgent.makeURI(getSipTarget(number));

  simpleUser.session.refer(uri, {
    onNotify: (notification) => {
      if (notification.request.body.match(new RegExp(`^SIP/2.0 200 OK`))) {
        simpleUser.hangup();
      } else {
        alert("Call transfer failed");
      }
    },
  });
};

function setClientState(state) {
  stateSpan.innerHTML = state;
}

function setCallState(state) {
  callStateSpan.innerHTML = state;
}

function getSipTarget(number) {
  return `sip:${number}@${Config.domain}`;
}

// Add click listener to connect button
connectButton.addEventListener("click", () => {
  simpleUser = new SimpleUser(`wss://${Config.domain}/`, {
    aor: getSipTarget(Config.extension),
    delegate: EventDelegate,
    media: {
      remote: {
        audio: audioElement,
      },
    },
    userAgentOptions: {
      authorizationUsername: Config.extension,
      authorizationPassword: Config.password,
      displayName: DisplayName,
      userAgentString: " Demo Client",
      logLevel: "error", // "debug" | "log" | "warn" | "error";
    },
  });

  simpleUser.connect().catch((error) => {
    console.error(`[${simpleUser.id}] failed to connect`);
    console.error(error);
    alert("Failed to connect.\n" + error);
  });
});

// Add click listener to call button
callButton.addEventListener("click", () => {
  disable([callButton, targetInput, hangupButton]);

  simpleUser
    .call(getSipTarget(Config.target), {
      inviteWithoutSdp: false,
    })
    .catch((error) => {
      console.error(`[${simpleUser.id}] failed to place call`);
      console.error(error);
      alert("Failed to place call.\n" + error);
    });
});

// Add click listener to hangup button
hangupButton.addEventListener("click", () => {
  disable([callButton, targetInput, hangupButton]);

  simpleUser.hangup().catch((error) => {
    console.error(`[${simpleUser.id}] failed to hangup call`);
    console.error(error);
    alert("Failed to hangup call.\n" + error);
  });
});

// Add click listener to disconnect button
disconnectButton.addEventListener("click", () => {
  simpleUser.disconnect().catch((error) => {
    console.error(`[${simpleUser.id}] failed to disconnect`);
    console.error(error);
    alert("Failed to disconnect.\n" + error);
  });
});

// Add click listeners to keypad buttons
keypad.forEach((button) => {
  button.addEventListener("click", () => {
    const tone = button.textContent;
    if (tone) {
      simpleUser.sendDTMF(tone).then(() => {
        dtmfSpan.innerHTML += tone;
      });
    }
  });
});

// Add change listener to hold checkbox
holdCheckbox.addEventListener("change", () => {
  if (holdCheckbox.checked) {
    // Checkbox is checked..
    simpleUser.hold().catch((error) => {
      checked(holdCheckbox, false);
      console.error(`[${simpleUser.id}] failed to hold call`);
      console.error(error);
      alert("Failed to hold call.\n" + error);
    });
  } else {
    // Checkbox is not checked..
    simpleUser.unhold().catch((error) => {
      checked(holdCheckbox);
      console.error(`[${simpleUser.id}] failed to unhold call`);
      console.error(error);
      alert("Failed to unhold call.\n" + error);
    });
  }
});

// Add change listener to mute checkbox
muteCheckbox.addEventListener("change", () => {
  if (muteCheckbox.checked) {
    // Checkbox is checked..
    simpleUser.mute();
    if (simpleUser.isMuted() === false) {
      checked(muteCheckbox, false);
      console.error(`[${simpleUser.id}] failed to mute call`);
      alert("Failed to mute call.\n");
    }
  } else {
    // Checkbox is not checked..
    simpleUser.unmute();
    if (simpleUser.isMuted() === true) {
      checked(muteCheckbox);
      console.error(`[${simpleUser.id}] failed to unmute call`);
      alert("Failed to unmute call.\n");
    }
  }
});

transferButton.addEventListener("click", () => {
  transferCall(Config.transferTarget);
});
incomingCloseButton.addEventListener("click", () => incomingDialog.close());
incomingAnswerButton.addEventListener("click", () => simpleUser.answer());
incomingDeclineButton.addEventListener("click", () => simpleUser.decline());

const showIncomingCall = (number) => {
  incomingNumber.innerHTML = number;
  incomingDialog.showModal();
};

const callControlsDisabled = (disabled = true) => {
  dtmfSpan.innerHTML = "";
  checked([muteCheckbox, holdCheckbox], false);
  disable(
    [holdCheckbox, muteCheckbox, transferInput, transferButton, ...keypad],
    disabled
  );
  display(callControls, !disabled);
};

const connectDisabled = (disabled = true) =>
  disable(
    [domainInput, extensionInput, passwordInput, connectButton],
    disabled
  );

const display = (el, display = true) => {
  if (typeof display === "string") {
    el.style.display = display;
  } else {
    el.style.display = display ? "block" : "none";
  }
};

const disable = (elements, disable = true) => {
  if (elements?.length) {
    for (const el of elements) {
      el.disabled = disable;
    }
  } else if (elements instanceof HTMLElement) {
    elements.disabled = disable;
  }
};

const checked = (elements, checked = true) => {
  if (elements?.length) {
    for (const el of elements) {
      el.checked = checked;
    }
  } else if (elements instanceof HTMLElement) {
    elements.checked = checked;
  }
};
