import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useToast } from '@/hooks/use-toast';
import { formatBrazilianCurrency } from '@/lib/utils';

// Fix para ícones padrão do Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Station {
  id: number;
  name: string;
  lat: number;
  lng: number;
  price: string;
  type: 'nossa' | 'concorrente' | 'cliente' | 'pesquisa';
  product: string;
  region?: string;
  researchData?: any[];
}

interface LeafletMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onStationSelect: (station: Station) => void;
}

// Componente para ajustar o bounds do mapa
function MapBounds({ stations }: { stations: Station[] }) {
  const map = useMap();

  useEffect(() => {
    if (stations.length === 0) return;

    const bounds = L.latLngBounds(
      stations
        .filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
        .map(s => [s.lat, s.lng] as [number, number])
    );

    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15
    });
  }, [stations, map]);

  return null;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({ 
  stations, 
  selectedStation, 
  onStationSelect 
}) => {
  const { toast } = useToast();

  const getStationColor = (type: string) => {
    switch (type) {
      case 'nossa': return '#2563eb'; // blue
      case 'concorrente': return '#dc2626'; // red
      case 'cliente': return '#16a34a'; // green
      default: return '#6b7280'; // gray
    }
  };

  const createCustomIcon = (type: string) => {
    const color = getStationColor(type);
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `<div style="
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });
  };

  const generatePopupContent = (station: Station) => {
    const regionNames: { [key: string]: string } = {
      'mg': 'Minas Gerais',
      'go': 'Goiás', 
      'df': 'Distrito Federal',
      'sp': 'São Paulo',
      'other': 'Outras'
    };

    // Formatar nome do produto
    const formatProductName = (product: string) => {
      const productNames: { [key: string]: string } = {
        'gasolina_comum': 'Gasolina Comum',
        'gasolina_aditivada': 'Gasolina Aditivada',
        'etanol': 'Etanol',
        'diesel': 'Diesel',
        'diesel_s10': 'Diesel S-10',
        's10': 'Diesel S-10',
        'arla': 'ARLA'
      };
      return productNames[product?.toLowerCase()] || product?.replace('_', ' ') || 'Produto';
    };

    let html = `
      <div style="padding: 12px; min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${getStationColor(station.type)}"></div>
          <h3 style="font-weight: 600; font-size: 14px; margin: 0;">${station.name}</h3>
        </div>
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
          ${station.region ? regionNames[station.region] || station.region.toUpperCase() : ''}
        </div>
    `;
    
    // Mostrar produto
    if (station.product) {
      html += `<div style="font-size: 12px; color: #666; margin-bottom: 8px;">Produto: ${formatProductName(station.product)}</div>`;
    }
    
    // Para postos da nossa rede, não mostrar preço
    if (station.type !== 'nossa') {
      html += `<div style="font-size: 14px; font-weight: bold; color: #2563eb; margin-bottom: 8px;">${station.price}</div>`;
    }

    // Se tem dados de pesquisa, mostrar preços por produto
    if (station.researchData && station.researchData.length > 0) {
      const pricesByProduct = new Map<string, number[]>();
      
      station.researchData.forEach(research => {
        if (!pricesByProduct.has(research.product)) {
          pricesByProduct.set(research.product, []);
        }
        pricesByProduct.get(research.product)!.push(research.price);
      });

      if (pricesByProduct.size > 0) {
        html += `<div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">`;
        html += `<div style="font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Preços por Produto:</div>`;
        
        Array.from(pricesByProduct.entries()).forEach(([product, prices]) => {
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice = prices.reduce((acc, price) => acc + price, 0) / prices.length;
          
          html += `
            <div style="font-size: 12px; margin-bottom: 4px;">
              <div style="font-weight: 500;">${product.replace('_', ' ')}</div>
              <div style="display: flex; justify-content: space-between;">
                <span>Min: ${formatBrazilianCurrency(minPrice)}</span>
                <span>Max: ${formatBrazilianCurrency(maxPrice)}</span>
              </div>
              <div style="text-align: center; color: #16a34a; font-weight: 600;">
                Média: ${formatBrazilianCurrency(avgPrice)}
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
    }

    html += `</div>`;
    return html;
  };

  const handleMarkerClick = (station: Station) => {
    onStationSelect(station);
    toast({
      title: "Posto selecionado",
      description: `${station.name} - ${station.price}`
    });
  };

  const defaultCenter: [number, number] = [-23.5505, -46.6333]; // São Paulo
  const defaultZoom = 12;

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds stations={stations} />
        
        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={createCustomIcon(station.type)}
            eventHandlers={{
              click: () => handleMarkerClick(station)
            }}
          >
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: generatePopupContent(station) }} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

