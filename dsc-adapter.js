import {Adapter, Device, Property} from 'gateway-addon';
import SerialPort from 'serialport';
import Readline from '@serialport/parser-readline'

class ZoneDevice extends Device {
  constructor(adapter, id, zoneType) {
    super(adapter, id);
    Object.assign(this, {title:id, ...sensorTypes[zoneType] })
    for(p in ['inAlarm', 'tamper', 'fault', 'tripped']) {
        this.properties.set(p, new Property(this, p, {type: 'boolean', readOnly: true} )) // looks strange
    }
    adapter.handleDeviceAdded(this);
  }
}

const zoneCommands = new Map([
    ['601', { prop: 'inAlarm', value: true  }],
    ['602', { prop: 'inAlarm', value: false }],
    ['603', { prop: 'tamper',  value: true  }],
    ['604', { prop: 'tamper',  value: false }],
    ['605', { prop: 'fault',   value: true  }],
    ['606', { prop: 'fault',   value: false }],
    ['609', { prop: 'tripped', value: true  }],
    ['610', { prop: 'tripped', value: false }]
])

class ZonesAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, manifest.name, manifest.name);
    addonManager.addAdapter(this);

    const config = manifest.moziot.config;
    if (config && config.zones && Array.isArray(config.zones)) {
        throw 'Bad Configutation: must contain an array of zones';
    }
    const zones = new Map( config.zones.map( zone =>
        [zone.id, new ZoneDevice(this, `zone-${zone.id}`, zone.type)]
    ))

    this.serialPort = new SerialPort(config.port) // poor practice
    if( !this.serialPort ) {
        throw 'Can not open serial port to DSC panel'
    }
    this.serialPort.pipe(new Readline()).on('data', data => {
        const
            cmd = zoneCommands.get(data.slice(0,3)),
            zone = zones.get(data.slice(3,6))
        if( cmd  && zone ) {
            zone.setProperty(cmd.prop, cmd.value)
        }
    })
  }
  unload() {
        this.serialPort.close()
        this.serialPort = null // allow garbage collection
        return super.unload()
    }
}

function loadDscAdapter(addonManager, manifest, errorCallback) {
// may we should load config - right now hard coded to what is in manifest
    try{ new DSCAdapter(addonManager, manifest) }
    catch(err) { errorCallback() }
}

module.exports = loadDscAdapter;