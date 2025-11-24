import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useToast } from '@/hooks/use-toast';
import { formatBrazilianCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

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
  station_id?: string;
  lastUpdate?: string;
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

// Componente para marcador com popup assíncrono
function StationMarker({ 
  station, 
  createCustomIcon, 
  handleMarkerClick, 
  generatePopupContent 
}: { 
  station: Station; 
  createCustomIcon: (type: string) => L.DivIcon;
  handleMarkerClick: (station: Station) => void;
  generatePopupContent: (station: Station) => Promise<string>;
}) {
  const [popupContent, setPopupContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    generatePopupContent(station).then(content => {
      setPopupContent(content);
      setLoading(false);
    }).catch(err => {
      console.error('Erro ao gerar popup:', err);
      setPopupContent('<div style="padding: 12px;">Erro ao carregar informações</div>');
      setLoading(false);
    });
  }, [station, generatePopupContent]);

  return (
    <Marker
      position={[station.lat, station.lng]}
      icon={createCustomIcon(station.type)}
      eventHandlers={{
        click: () => handleMarkerClick(station)
      }}
    >
      <Popup>
        {loading ? (
          <div style={{ padding: '12px', textAlign: 'center' }}>Carregando...</div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: popupContent }} />
        )}
      </Popup>
    </Marker>
  );
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

  const generatePopupContent = async (station: Station): Promise<string> => {
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
        's10_aditivado': 'Diesel S-10 Aditivado',
        'diesel_s500': 'Diesel S-500',
        'diesel_s500_aditivado': 'Diesel S-500 Aditivado',
        'arla32_granel': 'ARLA 32 Granel',
        'arla': 'ARLA'
      };
      return productNames[product?.toLowerCase()] || product?.replace('_', ' ') || 'Produto';
    };

    // Buscar histórico semanal e preços por produto se tiver station_id válido
    let weeklyHistory: any[] = [];
    let pricesByProduct: Map<string, { price: number; date: string }> = new Map();
    
    if (station.station_id && typeof station.station_id === 'string' && station.station_id.trim() !== '') {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Validar se station_id é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(station.station_id);
        
        if (isValidUUID) {
          // Buscar histórico semanal do produto atual
          const { data: historyData, error: historyError } = await supabase
            .from('price_history')
            .select('*')
            .eq('station_id', station.station_id)
            .eq('product', station.product || '')
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(7);

          if (!historyError && historyData) {
            weeklyHistory = historyData;
          }

          // Buscar preços mais recentes por produto
          const { data: allProductsData, error: productsError } = await supabase
            .from('price_history')
            .select('product, new_price, created_at')
            .eq('station_id', station.station_id)
            .order('created_at', { ascending: false });

          if (!productsError && allProductsData) {
            // Pegar o preço mais recente de cada produto
            allProductsData.forEach(item => {
              if (!pricesByProduct.has(item.product) || 
                  new Date(item.created_at) > new Date(pricesByProduct.get(item.product)!.date)) {
                pricesByProduct.set(item.product, {
                  price: item.new_price,
                  date: item.created_at
                });
              }
            });
          }

          // Se não encontrou em price_history, tentar price_suggestions
          if (pricesByProduct.size === 0) {
            const { data: suggestionsData, error: suggestionsError } = await supabase
              .from('price_suggestions')
              .select('product, final_price, created_at')
              .eq('station_id', station.station_id)
              .eq('status', 'approved')
              .order('created_at', { ascending: false });

            if (!suggestionsError && suggestionsData) {
              suggestionsData.forEach(item => {
                if (!pricesByProduct.has(item.product) || 
                    new Date(item.created_at) > new Date(pricesByProduct.get(item.product)!.date)) {
                  pricesByProduct.set(item.product, {
                    price: item.final_price,
                    date: item.created_at
                  });
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar dados:', err);
      }
    }

    // Formatar data
    const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Determinar última atualização
    const lastUpdate = station.lastUpdate || (weeklyHistory.length > 0 ? weeklyHistory[0].created_at : null);
    
    let html = `
      <div style="padding: 10px; min-width: 220px; max-width: 280px;">
        <!-- Nome do posto -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${getStationColor(station.type)}; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>
            <h3 style="font-weight: 700; font-size: 13px; margin: 0; color: #1f2937;">${station.name}</h3>
          </div>
          ${station.region ? `<div style="font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-left: 16px;">
            ${regionNames[station.region] || station.region.toUpperCase()}
          </div>` : ''}
        </div>
        
        <!-- Preço atual -->
        ${station.type !== 'nossa' ? `
          <div style="margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 6px; border-left: 3px solid #2563eb;">
            <div style="font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px;">
              Preço Atual - ${formatProductName(station.product)}
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #2563eb;">
              ${station.price}
            </div>
          </div>
        ` : ''}
        
        <!-- Preços por Produto -->
        ${pricesByProduct.size > 0 ? `
          <div style="margin-bottom: 8px; padding: 8px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 6px; border-left: 3px solid #16a34a;">
            <div style="font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px;">
              Preços por Produto
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${Array.from(pricesByProduct.entries()).map(([product, data]) => {
                const productColor = data.price < 5.0 ? '#16a34a' : data.price < 6.0 ? '#eab308' : '#dc2626';
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; background: white; border-radius: 3px; border-left: 2px solid ${productColor};">
                    <span style="font-size: 10px; font-weight: 600; color: #374151;">${formatProductName(product)}</span>
                    <span style="font-size: 11px; font-weight: 700; color: ${productColor};">
                      ${formatBrazilianCurrency(data.price)}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Última atualização -->
        ${lastUpdate ? `
          <div style="margin-bottom: 8px; padding: 6px; background: #f9fafb; border-radius: 4px; border-left: 2px solid #9ca3af;">
            <div style="font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">
              Última Atualização
            </div>
            <div style="font-size: 10px; font-weight: 600; color: #374151;">
              ${formatDate(lastUpdate)}
            </div>
          </div>
        ` : ''}
    `;

    // Histórico semanal
    html += `<div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">`;
    html += `<div style="font-size: 10px; font-weight: 700; color: #1f2937; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px;">
      Histórico Semanal
    </div>`;
    
    if (weeklyHistory.length > 0) {
      // Agrupar por dia
      const historyByDay = new Map<string, any[]>();
      weeklyHistory.forEach(item => {
        const date = new Date(item.created_at);
        const dayKey = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!historyByDay.has(dayKey)) {
          historyByDay.set(dayKey, []);
        }
        historyByDay.get(dayKey)!.push(item);
      });

      // Mostrar últimos 7 dias
      Array.from(historyByDay.entries()).slice(0, 7).forEach(([day, items]) => {
        const latestPrice = items[0].new_price;
        const oldPrice = items[0].old_price;
        const change = oldPrice ? latestPrice - oldPrice : 0;
        const changeColor = change > 0 ? '#dc2626' : change < 0 ? '#16a34a' : '#6b7280';
        const changeIcon = change > 0 ? '↑' : change < 0 ? '↓' : '→';
        
        html += `
          <div style="font-size: 10px; margin-bottom: 4px; padding: 5px; background: #f9fafb; border-radius: 4px; border-left: 2px solid ${changeColor};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600; color: #374151;">${day}</span>
              <span style="font-weight: 700; color: #2563eb; font-size: 11px;">${formatBrazilianCurrency(latestPrice)}</span>
            </div>
            ${oldPrice ? `
              <div style="font-size: 9px; color: ${changeColor}; font-weight: 600; margin-top: 2px;">
                ${changeIcon} ${change > 0 ? '+' : ''}${formatBrazilianCurrency(Math.abs(change))}
              </div>
            ` : ''}
          </div>
        `;
      });
    } else {
      html += `
        <div style="padding: 8px; background: #f3f4f6; border-radius: 4px; text-align: center;">
          <div style="font-size: 10px; color: #6b7280; font-style: italic;">
            Nenhum histórico disponível
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    
    // Fallback: dados de pesquisa se não tiver histórico
    if (weeklyHistory.length === 0 && station.researchData && station.researchData.length > 0) {
      // Fallback: mostrar dados de pesquisa se não tiver histórico
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
              <div style="font-weight: 500;">${formatProductName(product)}</div>
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span>Min: ${formatBrazilianCurrency(minPrice)}</span>
                <span>Max: ${formatBrazilianCurrency(maxPrice)}</span>
              </div>
              <div style="text-align: center; color: #16a34a; font-weight: 600; font-size: 11px;">
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
    <div className="h-96 w-full rounded-lg overflow-hidden relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds stations={stations} />
        
        {stations.map((station) => (
          <StationMarker
            key={station.id}
            station={station}
            createCustomIcon={createCustomIcon}
            handleMarkerClick={handleMarkerClick}
            generatePopupContent={generatePopupContent}
          />
        ))}
      </MapContainer>
    </div>
  );
};

