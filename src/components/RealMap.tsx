import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapConfig } from '@/context/MapConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { formatBrazilianCurrency } from '@/lib/utils';

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

interface RealMapProps {
  stations: Station[];
  selectedStation: Station | null;
  onStationSelect: (station: Station) => void;
}

export const RealMap: React.FC<RealMapProps> = ({ stations, selectedStation, onStationSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const { mapboxToken, isMapConfigured } = useMapConfig();
  const navigate = useNavigate();
  const { toast } = useToast();

  const getStationColor = (type: string) => {
    switch (type) {
      case 'nossa': return '#2563eb'; // blue
      case 'concorrente': return '#dc2626'; // red
      case 'cliente': return '#16a34a'; // green
      default: return '#6b7280'; // gray
    }
  };

  const generatePopupHTML = (station: Station) => {
    const regionNames: { [key: string]: string } = {
      'mg': 'Minas Gerais',
      'go': 'Goiás', 
      'df': 'Distrito Federal',
      'sp': 'São Paulo',
      'other': 'Outras'
    };

    let html = `
      <div class="p-3 min-w-[200px]">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-3 h-3 rounded-full" style="background-color: ${getStationColor(station.type)}"></div>
          <h3 class="font-semibold text-sm">${station.name}</h3>
        </div>
        <div class="text-xs text-gray-600 mb-2">
          ${station.region ? regionNames[station.region] || station.region.toUpperCase() : ''}
        </div>
        <div class="text-sm font-bold text-blue-600 mb-2">${station.price}</div>
    `;

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
        html += `<div class="border-t pt-2 mt-2">`;
        html += `<div class="text-xs font-medium text-gray-700 mb-1">Preços por Produto:</div>`;
        
        Array.from(pricesByProduct.entries()).forEach(([product, prices]) => {
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice = prices.reduce((acc, price) => acc + price, 0) / prices.length;
          
          html += `
            <div class="text-xs mb-1">
              <div class="font-medium">${product.replace('_', ' ')}</div>
              <div class="flex justify-between">
                <span>Min: ${formatBrazilianCurrency(minPrice)}</span>
                <span>Max: ${formatBrazilianCurrency(maxPrice)}</span>
              </div>
              <div class="text-center text-green-600 font-semibold">
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

  useEffect(() => {
    if (!mapContainer.current) return;

    // Hardcoded Mapbox token - sempre funcionará
    mapboxgl.accessToken = 'pk.eyJ1IjoiZGF2aWd1ZWRlcyIsImEiOiJjbWZiZG1oZ3MwbTcyMmxwb2RuMDVrbnlvIn0.zuZgESN8FZe8FLQISVZfxw';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-46.6333, -23.5505], // São Paulo coordinates
      zoom: 12,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Clean up markers when component unmounts
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      if (map.current) map.current.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for each station
    stations.forEach(station => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.backgroundColor = getStationColor(station.type);
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([station.lng, station.lat])
        .addTo(map.current!);

      // Add click handler
      el.addEventListener('click', () => {
        onStationSelect(station);
        toast({
          title: "Posto selecionado",
          description: `${station.name} - ${station.price}`
        });
      });

      // Add popup
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(generatePopupHTML(station));

      marker.setPopup(popup);
      markers.current.push(marker);
    });

    // Ajustar o mapa para enquadrar todos os marcadores
    if (stations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      stations.forEach(s => {
        if (typeof s.lng === 'number' && typeof s.lat === 'number') {
          bounds.extend([s.lng, s.lat]);
        }
      });
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 40, duration: 500 });
      }
    }
  }, [stations, onStationSelect, toast]);

  // Mapa sempre configurado com token hardcoded
  return (
    <div ref={mapContainer} className="h-96 w-full rounded-lg" />
  );
};