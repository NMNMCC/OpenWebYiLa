import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Cause, Effect } from "effect";
import { useEffect, useState } from "react";
import { appRuntime } from "../app-runtime";
import {
  createDefaultDeviceConfig,
  type YiLaDeviceConfig,
} from "../features/yila/device-config";
import { DeviceStore } from "../features/yila/device-store";
import { YiLa } from "../features/yila";

const listStoredDevicesEffect = Effect.flatMap(DeviceStore, (store) => store.list);
const listGrantedDevicesEffect = Effect.flatMap(YiLa, (yila) => yila.getDevices);

const formatUnknownError = (error: unknown): string =>
  Cause.pretty(
    Cause.isCause(error)
      ? error
      : error instanceof Error
        ? Cause.die(error)
        : Cause.fail(error),
    { renderErrorCause: true },
  );

const clampIndex = (index: number, size: number) => {
  if (size === 0) {
    return 0;
  }

  return Math.min(index, size - 1);
};

const saveDeviceConfig = (config: YiLaDeviceConfig) =>
  Effect.flatMap(DeviceStore, (store) => store.save(config));

const getGrantedDeviceByIdEffect = (id: string) =>
  Effect.flatMap(YiLa, (yila) => yila.getDeviceById(id));

const requestDeviceEffect = Effect.flatMap(YiLa, (yila) => yila.request);

export default function Home() {
  const [storedDevices, setStoredDevices] = useState<ReadonlyArray<YiLaDeviceConfig>>([]);
  const [grantedDevices, setGrantedDevices] = useState<
    Record<string, BluetoothDevice>
  >({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitState, setPasswordSubmitState] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [deviceMenuAnchor, setDeviceMenuAnchor] = useState<HTMLElement | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<YiLaDeviceConfig | null>(null);
  const [nextPassword, setNextPassword] = useState("");
  const [batteryById, setBatteryById] = useState<Record<string, number | null>>({});

  const selectedConfig = storedDevices[selectedIndex];
  const selectedDevice = selectedConfig ? grantedDevices[selectedConfig.id] : undefined;
  const selectedBattery =
    selectedConfig === undefined ? null : batteryById[selectedConfig.id] ?? null;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [devices, granted] = await Promise.all([
          appRuntime.runPromise(listStoredDevicesEffect),
          appRuntime.runPromise(listGrantedDevicesEffect),
        ]);

        if (cancelled) {
          return;
        }

        setStoredDevices(devices);
        setSelectedIndex((current) => clampIndex(current, devices.length));
        setGrantedDevices(
          Object.fromEntries(granted.map((device) => [device.id, device])),
        );
      } catch (error) {
        if (!cancelled) {
          setPageError(formatUnknownError(error));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddDevice = async () => {
    setBusyMessage("正在添加设备");
    setPageError(null);

    try {
      const device = await appRuntime.runPromise(
        Effect.flatMap(YiLa, (yila) => yila.request),
      );
      const existing = storedDevices.find((item) => item.id === device.id);
      const nextConfig =
        existing === undefined
          ? createDefaultDeviceConfig(device)
          : {
              ...existing,
              name: device.name ?? existing.name,
            };
      const devices = await appRuntime.runPromise(saveDeviceConfig(nextConfig));

      setStoredDevices(devices);
      setGrantedDevices((current) => ({
        ...current,
        [device.id]: device,
      }));
      setSelectedIndex(
        Math.max(
          0,
          devices.findIndex((item) => item.id === device.id),
        ),
      );
    } catch (error) {
      setPageError(formatUnknownError(error));
    } finally {
      setBusyMessage(null);
    }
  };

  const handleUnlock = async () => {
    if (selectedConfig === undefined) {
      setPageError("先添加一个 YILA 设备");
      return;
    }

    setBusyMessage("正在开锁");
    setPageError(null);

    try {
      const resolvedDevice = await ensureAuthorizedDevice(selectedConfig);

      setGrantedDevices((current) => ({
        ...current,
        [resolvedDevice.id]: resolvedDevice,
      }));

      const response = await appRuntime.runPromise(
        Effect.flatMap(YiLa, (yila) =>
          yila.open({
            device: resolvedDevice,
            password: selectedConfig.password,
            open: selectedConfig.open,
            wait: selectedConfig.wait,
            close: selectedConfig.close,
            direction: selectedConfig.direction,
            responseTimeout: selectedConfig.responseTimeout,
          }),
        ),
      );

      setBatteryById((current) => ({
        ...current,
        [selectedConfig.id]: response.batteryLevel,
      }));
      setPageError(response.success ? null : response.message);
    } catch (error) {
      setPageError(formatUnknownError(error));
    } finally {
      setBusyMessage(null);
    }
  };

  const openSettings = () => {
    if (selectedConfig === undefined) {
      return;
    }

    setSettingsDraft(selectedConfig);
    setNextPassword("");
    setSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    if (settingsDraft === null) {
      return;
    }

    setBusyMessage("正在保存配置");
    setPageError(null);

    try {
      const devices = await appRuntime.runPromise(saveDeviceConfig(settingsDraft));
      setStoredDevices(devices);
      setSelectedIndex((current) => clampIndex(current, devices.length));
      setSettingsOpen(false);
    } catch (error) {
      setPageError(formatUnknownError(error));
    } finally {
      setBusyMessage(null);
    }
  };

  const handleChangePassword = async () => {
    if (selectedConfig === undefined) {
      return false;
    }

    const trimmedPassword = nextPassword.trim();
    if (trimmedPassword.length === 0) {
      setPasswordError("请输入新密码");
      return false;
    }

    setBusyMessage("正在修改设备密码");
    setPasswordError(null);

    try {
      const resolvedDevice = await ensureAuthorizedDevice(selectedConfig);

      setGrantedDevices((current) => ({
        ...current,
        [resolvedDevice.id]: resolvedDevice,
      }));

      const response = await appRuntime.runPromise(
        Effect.flatMap(YiLa, (yila) =>
          yila.passwd({
            device: resolvedDevice,
            oldPassword: selectedConfig.password,
            newPassword: trimmedPassword,
            responseTimeout: selectedConfig.responseTimeout,
          }),
        ),
      );

      if (!response.success) {
      setPasswordError(response.message);
        return false;
      }

      const nextConfig = {
        ...selectedConfig,
        password: trimmedPassword,
      };
      const devices = await appRuntime.runPromise(saveDeviceConfig(nextConfig));

      setStoredDevices(devices);
      setSettingsDraft(nextConfig);
      setNextPassword("");
      return true;
    } catch (error) {
      setPasswordError(formatUnknownError(error));
      return false;
    } finally {
      setBusyMessage(null);
    }
  };

  const ensureAuthorizedDevice = async (config: YiLaDeviceConfig) => {
    const cachedDevice = grantedDevices[config.id];
    if (cachedDevice !== undefined) {
      return cachedDevice;
    }

    const grantedDevice = await appRuntime.runPromise(getGrantedDeviceByIdEffect(config.id));
    if (grantedDevice !== undefined) {
      return grantedDevice;
    }

    return await appRuntime.runPromise(requestDeviceEffect);
  };

  const handleDeleteDevice = async () => {
    if (selectedConfig === undefined) {
      return;
    }

    setBusyMessage("正在删除设备");
    setPageError(null);

    try {
      const devices = await appRuntime.runPromise(
        Effect.flatMap(DeviceStore, (store) => store.remove(selectedConfig.id)),
      );

      setStoredDevices(devices);
      setGrantedDevices((current) => {
        const next = { ...current };
        delete next[selectedConfig.id];
        return next;
      });
      setBatteryById((current) => {
        const next = { ...current };
        delete next[selectedConfig.id];
        return next;
      });
      setSelectedIndex((current) => clampIndex(current, devices.length));
      setDeleteOpen(false);
      setSettingsOpen(false);
    } catch (error) {
      setPageError(formatUnknownError(error));
    } finally {
      setBusyMessage(null);
    }
  };

  const updateDraftField = <K extends keyof YiLaDeviceConfig>(
    key: K,
    value: YiLaDeviceConfig[K],
  ) => {
    setSettingsDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            [key]: value,
          },
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1,
        }}
      >
        <Button
          variant="contained"
          onClick={() => {
            void handleAddDevice();
          }}
          disabled={busyMessage !== null}
        >
          + 添加
        </Button>
        <Button
          variant="outlined"
          onClick={(event) => {
            setDeviceMenuAnchor(event.currentTarget);
          }}
          disabled={storedDevices.length === 0}
        >
          设备
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1,
        }}
      >
        <Button
          variant="outlined"
          onClick={() => {
            setNextPassword("");
            setPasswordError(null);
            setPasswordSubmitState("idle");
            setPasswordOpen(true);
          }}
          disabled={selectedConfig === undefined}
        >
          修改密码
        </Button>
        <Button
          variant="outlined"
          onClick={openSettings}
          disabled={selectedConfig === undefined}
        >
          设置
        </Button>
      </Stack>

      <Box
        sx={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 1,
        }}
      >
        <Button
          color="error"
          variant="outlined"
          onClick={() => {
            setDeleteOpen(true);
          }}
          disabled={selectedConfig === undefined || busyMessage !== null}
        >
          删除
        </Button>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
        }}
      >
        <Box
          sx={{ width: "100%" }}
          onClick={() => {
            void handleUnlock();
          }}
        >
          <Stack
            spacing={2}
            alignItems="center"
            textAlign="center"
          >
            {busyMessage !== null ? <CircularProgress /> : null}

            {selectedConfig === undefined ? (
              <>
                <Typography variant="h5">还没有 YILA 设备</Typography>
                <Typography color="text.secondary">
                  点击左上角 + 按钮来添加设备
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h4">{selectedConfig.name}</Typography>
                <Typography color="text.secondary">
                  {selectedDevice === undefined
                    ? "需要重新授权"
                    : "点击页面空白处即可开锁"}
                </Typography>
                {pageError === null ? null : (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {pageError}
                  </Typography>
                )}
                {selectedBattery === null ? null : (
                  <Typography color="text.secondary">
                    电量 {selectedBattery}/5
                  </Typography>
                )}
              </>
            )}
          </Stack>
        </Box>
      </Box>

      <Menu
        anchorEl={deviceMenuAnchor}
        open={deviceMenuAnchor !== null}
        onClose={() => {
          setDeviceMenuAnchor(null);
        }}
      >
        <List dense disablePadding>
          {storedDevices.map((device, index) => (
            <ListItemButton
              key={device.id}
              selected={index === selectedIndex}
              onClick={() => {
                setSelectedIndex(index);
                setDeviceMenuAnchor(null);
              }}
            >
              <ListItemText primary={device.name} />
            </ListItemButton>
          ))}
        </List>
      </Menu>

      <Dialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
        fullWidth
      >
        <DialogTitle>设备设置</DialogTitle>
        <DialogContent>
          {settingsDraft === null ? null : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="设备名称"
                value={settingsDraft.name}
                onChange={(event) => {
                  updateDraftField("name", event.target.value);
                }}
                fullWidth
              />
              <TextField
                label="本地密码"
                value={settingsDraft.password}
                onChange={(event) => {
                  updateDraftField("password", event.target.value);
                }}
                fullWidth
              />
              <TextField
                label="开门时长(ms)"
                type="number"
                value={settingsDraft.open}
                onChange={(event) => {
                  updateDraftField("open", Number(event.target.value));
                }}
                fullWidth
              />
              <TextField
                label="等待时长(ms)"
                type="number"
                value={settingsDraft.wait}
                onChange={(event) => {
                  updateDraftField("wait", Number(event.target.value));
                }}
                fullWidth
              />
              <TextField
                label="关门时长(ms)"
                type="number"
                value={settingsDraft.close}
                onChange={(event) => {
                  updateDraftField("close", Number(event.target.value));
                }}
                fullWidth
              />
              <TextField
                select
                label="方向"
                value={settingsDraft.direction}
                onChange={(event) => {
                  updateDraftField("direction", event.target.value as "+" | "-");
                }}
                fullWidth
              >
                <MenuItem value="+">
                  +
                </MenuItem>
                <MenuItem value="-">
                  -
                </MenuItem>
              </TextField>
              <TextField
                label="响应超时(ms)"
                type="number"
                value={settingsDraft.responseTimeout}
                onChange={(event) => {
                  updateDraftField("responseTimeout", Number(event.target.value));
                }}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSettingsOpen(false);
            }}
          >
            取消
          </Button>
          <Button
            onClick={() => {
              void handleSaveSettings();
            }}
            disabled={settingsDraft === null || busyMessage !== null}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
        }}
        fullWidth
      >
        <DialogTitle>修改密码</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="新密码"
              value={nextPassword}
              onChange={(event) => {
                setNextPassword(event.target.value);
              }}
              fullWidth
            />
            {passwordError === null ? null : (
              <Typography
                variant="caption"
                color="error"
                sx={{ fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {passwordError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPasswordOpen(false);
            }}
          >
            取消
          </Button>
          <Button
            onClick={() => {
              setPasswordSubmitting(true);
              setPasswordSubmitState("idle");
              void handleChangePassword()
                .then((success) => {
                  if (success) {
                    setPasswordSubmitState("success");
                    window.setTimeout(() => {
                      setPasswordOpen(false);
                      setPasswordSubmitState("idle");
                    }, 300);
                  } else {
                    setPasswordSubmitState("error");
                  }
                })
                .finally(() => {
                  setPasswordSubmitting(false);
                });
            }}
            disabled={
              selectedConfig === undefined ||
              busyMessage !== null ||
              passwordSubmitting
            }
            color={
              passwordSubmitState === "success"
                ? "success"
                : passwordSubmitState === "error"
                  ? "error"
                  : "primary"
            }
          >
            {passwordSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : passwordSubmitState === "success" ? (
              "✓"
            ) : passwordSubmitState === "error" ? (
              "✕"
            ) : (
              "保存"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
      >
        <DialogTitle>删除设备</DialogTitle>
        <DialogContent>
          <Typography>
            {selectedConfig === undefined
              ? "没有可删除的设备"
              : `确认删除设备 ${selectedConfig.name} 吗`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteOpen(false);
            }}
          >
            取消
          </Button>
          <Button
            color="error"
            onClick={() => {
              void handleDeleteDevice();
            }}
            disabled={selectedConfig === undefined || busyMessage !== null}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
