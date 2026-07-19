const map = L.map('map').setView([-0.95, 100.35], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 150,
}).addTo(map);

let geoLayer;
let indikatorData = {};
let currentIndikator = 'penduduk';

const kecamatanColors = {
  'Padang Barat': '#e6194b',
  'Padang Timur': '#3cb44b',
  'Padang Selatan': '#ffe119',
  'Padang Utara': '#4363d8',
  'Koto Tangah': '#f58231',
  'Kuranji': '#911eb4',
  'Lubuk Kilangan': '#46f0f0',
  'Lubuk Begalung': '#f032e6',
  'Pauh': '#bcf60c',
  'Bungus Teluk Kabung': '#fabebe',
  'Nanggalo': '#808000'
};

function getColor(nama) {
  return kecamatanColors[nama] || '#cccccc';
}

function style(feature) {
  const nama = feature.properties.nm_kecamatan || feature.properties.kecamatan;
  return {
    fillColor: getColor(nama),
    weight: 1,
    color: '#fff',
    fillOpacity: 0.7
  };
}

function onEachFeature(feature, layer) {
  layer.on('mouseover', function() {
    layer.setStyle({
      fillOpacity: 0.5
    });
  });

  const nama = feature.properties.nm_kecamatan;
  const data = indikatorData[nama];
  // const isiPopup = `
  //   <b>${nama}</b><br>
  //   Penduduk: ${data?.penduduk?.toLocaleString() || '-'}<br>
  //   Kepadatan: ${data?.kepadatan?.toLocaleString() || '-'}
  //   Koordinat: ${lat}, ${lng}
  //   `
  //   ;
  
  // layer.bindPopup(isiPopup);

  // layer.on('click', function(e) {
  //   map.fitBounds(layer.getBounds());
  // });

  layer.on({
    click: function (e) {
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>${nama}</b>
          <br>
          Penduduk: ${data?.penduduk?.toLocaleString() || '-'}
          <br>
          Kepadatan: ${data?.kepadatan?.toLocaleString() || '-'}
          <br>
          Koordinat Latitude: ${lat}
          <br>
          Koordinat Longitude: ${lng}
          `)
        .openOn(map);

      // Optional: Masukkan ke input form kalau ada
      document.getElementById('nama_puskemas').value = '';
      document.getElementById('lat').value = lat;
      document.getElementById('lng').value = lng;
    }
  });

  // console.log(feature);
  // console.log(layer);
}

fetch('data/indikator.json')
.then(res => res.json())
.then(data => {
  data.forEach(item => {
    indikatorData[item.kecamatan] = item;
  });

  fetch('data/padang_kecamatan.geojson')
    .then(res => res.json())
    .then(geojson => {
      geoLayer = L.geoJSON(geojson, {
        style: style,
        onEachFeature: onEachFeature
      }).addTo(map);
    });
});

// const puskesmasIcon = L.icon({
//   iconUrl: 'img/puskesmas.png',
//   iconSize: [30, 30]
// });

// Load Puskesmas data
// Pastikan file puskesmas.json ada di folder data
// Contoh data/puskesmas.json
// fetch('data/puskesmas.json')
// .then(res => res.json())
// .then(puskesmasList => {
//   puskesmasList.forEach(p => {
//     const marker = L.marker([p.lat, p.lng], { icon: puskesmasIcon }).addTo(map);
//     marker.bindPopup(`<b>${p.nama}</b>
//       <br>
//       Kecamatan: ${p.kecamatan}
//       <br>
//       Koordinat Latitude: ${p.lat}
//       <br>
//       Koordinat Longitude: ${p.lng}
//       <br>
//       <button onclick="editPuskesmas('${Base64.encode(JSON.stringify(p))}')">Edit</button>
//       `);
    
//   });
// });

document.getElementById('indikator').addEventListener('change', function () {
  currentIndikator = this.value;
  // warna tetap, tapi info popup bisa berubah jika mau
  geoLayer.setStyle(style); 
});

function editPuskesmas(params) {
  const puskesmas = indikatorData[params.kecamatan];
  console.log(Base64.decode(params));

  if (puskesmas) {
    document.getElementById('nama_puskemas').value = puskesmas.nama;
    document.getElementById('nama_kecamatan').value = puskesmas.kecamatan;
    document.getElementById('lat').value = puskesmas.lat;
    document.getElementById('lng').value = puskesmas.lng;
  } else {
    alert('Puskesmas tidak ditemukan!');
  }
}

var Base64 = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encode: function(e) {
        var t = "";
        var n, r, i, s, o, u, a;
        var f = 0;
        e = Base64._utf8_encode(e);
        while (f < e.length) {
            n = e.charCodeAt(f++);
            r = e.charCodeAt(f++);
            i = e.charCodeAt(f++);
            s = n >> 2;
            o = (n & 3) << 4 | r >> 4;
            u = (r & 15) << 2 | i >> 6;
            a = i & 63;
            if (isNaN(r)) {
                u = a = 64
            } else if (isNaN(i)) {
                a = 64
            }
            t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a)
        }
        return t
    },
    decode: function(e) {
        var t = "";
        var n, r, i;
        var s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) {
                t = t + String.fromCharCode(r)
            }
            if (a != 64) {
                t = t + String.fromCharCode(i)
            }
        }
        t = Base64._utf8_decode(t);
        return t
    },
    _utf8_encode: function(e) {
        e = e.replace(/\r\n/g, "\n");
        var t = "";
        for (var n = 0; n < e.length; n++) {
            var r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r)
            } else if (r > 127 && r < 2048) {
                t += String.fromCharCode(r >> 6 | 192);
                t += String.fromCharCode(r & 63 | 128)
            } else {
                t += String.fromCharCode(r >> 12 | 224);
                t += String.fromCharCode(r >> 6 & 63 | 128);
                t += String.fromCharCode(r & 63 | 128)
            }
        }
        return t
    },
    _utf8_decode: function(e) {
        var t = "";
        var n = 0;
        var r = c1 = c2 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3
            }
        }
        return t
    }
}