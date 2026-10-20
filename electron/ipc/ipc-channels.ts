/**
 * IPC Channel Names
 * All channel constants are defined here to prevent typos and
 * ensure consistent naming between main process and renderer.
 * 
 * Naming convention: <module>:<action>
 */

export const IPC_CHANNELS = {
  // ─── Storage ───────────────────────────────────────────────────────────────
  STORAGE_GET_CONNECTIONS:      'storage:getConnections',
  STORAGE_SAVE_CONNECTION:      'storage:saveConnection',
  STORAGE_UPDATE_CONNECTION:    'storage:updateConnection',
  STORAGE_DELETE_CONNECTION:    'storage:deleteConnection',
  STORAGE_UPDATE_LAST_CONNECTED:'storage:updateLastConnected',

  // ─── H Series ──────────────────────────────────────────────────────────────
  HSERIES_CONNECT:              'hseries:connect',
  HSERIES_DISCONNECT:           'hseries:disconnect',
  HSERIES_TEST_CONNECTION:      'hseries:testConnection',
  HSERIES_SEND_COMMAND:         'hseries:sendCommand',
  HSERIES_GET_DEVICE_INFO:      'hseries:getDeviceInfo',
  HSERIES_GET_STATUS:           'hseries:getStatus',
  // H Series — gerçek protokol komutları
  HSERIES_GET_DEVICE_DETAILS:   'hseries:getDeviceDetails',
  HSERIES_GET_SCREEN_DETAILS:   'hseries:getScreenDetails',
  HSERIES_GET_PRESET_LIST:      'hseries:getPresetList',
  HSERIES_LOAD_PRESET:          'hseries:loadPreset',
  // H Series — kontrol komutları
  HSERIES_GET_LAYER_ENUM:       'hseries:getLayerEnum',
  HSERIES_GET_LAYER_DETAILS:    'hseries:getLayerDetails',
  HSERIES_SET_BRIGHTNESS:       'hseries:setBrightness',
  HSERIES_SET_FREEZE:           'hseries:setFreeze',
  HSERIES_SET_FTB:              'hseries:setFTB',

  // ─── TU Series ─────────────────────────────────────────────────────────────
  TUSERIES_CONNECT:             'tuseries:connect',
  TUSERIES_DISCONNECT:          'tuseries:disconnect',
  TUSERIES_TEST_CONNECTION:     'tuseries:testConnection',
  TUSERIES_SEND_COMMAND:        'tuseries:sendCommand',
  TUSERIES_GET_DEVICE_INFO:     'tuseries:getDeviceInfo',
  TUSERIES_GET_STATUS:          'tuseries:getStatus',

  // ─── VX Series ─────────────────────────────────────────────────────────────
  VXSERIES_CONNECT:             'vxseries:connect',
  VXSERIES_DISCONNECT:          'vxseries:disconnect',
  VXSERIES_SEND_COMMAND:        'vxseries:sendCommand',
  VXSERIES_SEARCH_DEVICES:      'vxseries:searchDevices',
  VXSERIES_GET_DEVICE_INFO:     'vxseries:getDeviceInfo',
  VXSERIES_GET_STATUS:          'vxseries:getStatus',

  // ─── VX Pro ────────────────────────────────────────────────────────────────
  VXPRO_CONNECT:                'vxPro:connect',
  VXPRO_DISCONNECT:             'vxPro:disconnect',
  VXPRO_GET_STATUS:             'vxPro:getStatus',
  VXPRO_SET_BRIGHTNESS:         'vxPro:setBrightness',
  VXPRO_SET_FTB:                'vxPro:setFTB',
  VXPRO_SET_FREEZE:             'vxPro:setFreeze',
  VXPRO_LOAD_PRESET:            'vxPro:loadPreset',

  // ─── MCTRL Series ──────────────────────────────────────────────────────────
  MCTRL_LIST_PORTS:             'mctrl:listPorts',
  MCTRL_SCAN:                   'mctrl:scan',
  MCTRL_CONNECT:                'mctrl:connect',
  MCTRL_DISCONNECT:             'mctrl:disconnect',
  MCTRL_TEST_CONNECTION:        'mctrl:testConnection',
  MCTRL_SEND_COMMAND:           'mctrl:sendCommand',
  MCTRL_GET_DEVICE_INFO:        'mctrl:getDeviceInfo',
  MCTRL_GET_STATUS:             'mctrl:getStatus',

  // ─── Taurus (TB / TCC) Series ──────────────────────────────────────────────
  TAURUS_GET_LOCAL_SUBNETS:     'taurus:getLocalSubnets',
  TAURUS_DISCOVER:              'taurus:discover',
  TAURUS_CANCEL_DISCOVER:       'taurus:cancelDiscover',
  TAURUS_FETCH_BASE_INFO_ANON:  'taurus:fetchBaseInfoAnon',
  TAURUS_CONNECT:               'taurus:connect',
  TAURUS_DISCONNECT:            'taurus:disconnect',
  TAURUS_SEND_COMMAND:          'taurus:sendCommand',
  TAURUS_GET_STATUS:            'taurus:getStatus',
  // Events (Main -> Renderer)
  TAURUS_EVENT_DISCONNECTED:    'taurus:event:disconnected',
  TAURUS_EVENT_RECONNECTED:     'taurus:event:reconnected',
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
