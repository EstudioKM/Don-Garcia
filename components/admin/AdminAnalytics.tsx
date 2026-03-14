import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Reservation, Customer } from '../../types';
import { getAllReservations } from '../../services/reservationRepository';
import { listenToCustomers } from '../../services/customerRepository';
import Chart from 'chart.js/auto';

const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
  <div className="bg-stone-900/50 border border-stone-800 rounded-sm p-6 shadow-lg">
    <p className="text-sm uppercase tracking-widest text-stone-500 font-bold">{title}</p>
    <p className="text-4xl font-serif text-gold mt-2">{value}</p>
    {description && <p className="text-xs text-stone-600 mt-1">{description}</p>}
  </div>
);

const AdminAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [dateRange, setDateRange] = useState({
    start: thirtyDaysAgo.toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  
  const [activeFilter, setActiveFilter] = useState<'7d' | '14d' | '30d' | 'all' | null>('30d');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const reservations = await getAllReservations();
      setAllReservations(reservations);
      setLoading(false); // Set loading to false after reservations are fetched
    };
    const unsubscribeCustomers = listenToCustomers((customers) => {
      setAllCustomers(customers);
    });
    fetchData();
    return () => unsubscribeCustomers();
  }, []);

  const handleQuickFilterClick = (filter: '7d' | '14d' | '30d' | 'all') => {
    setActiveFilter(filter);
    let endDate = new Date();
    let startDate = new Date();

    switch (filter) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '14d':
            startDate.setDate(endDate.getDate() - 14);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case 'all':
            if (allReservations.length > 0) {
                // Ensure all dates are valid Date objects before getting timestamps
                const validDates = allReservations
                    .map(r => r.date instanceof Date ? r.date : r.date.toDate())
                    .filter(d => d && !isNaN(d.getTime()));

                if (validDates.length > 0) {
                    const dateTimestamps = validDates.map(d => d.getTime());
                    startDate = new Date(Math.min(...dateTimestamps));
                    endDate = new Date(Math.max(...dateTimestamps));
                } else {
                     // Fallback if no valid dates in reservations
                    endDate = new Date();
                    startDate = new Date();
                    startDate.setDate(endDate.getDate() - 30);
                }
            } else {
                // Fallback if no reservations at all
                endDate = new Date();
                startDate = new Date();
                startDate.setDate(endDate.getDate() - 30);
            }
            break;
    }

    setDateRange({
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
    });
  };

  const filteredData = useMemo(() => {
    if (loading) return [];
    const startDate = new Date(dateRange.start + 'T00:00:00');
    const endDate = new Date(dateRange.end + 'T23:59:59');

    return allReservations.filter(r => {
      const resDate = r.date instanceof Date ? r.date : r.date.toDate();
      return resDate >= startDate && resDate <= endDate;
    });
  }, [allReservations, dateRange, loading]);

  const analytics = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalReservations = filteredData.length;
    
    // Reservation Analytics
    const confirmed = filteredData.filter(r => r.status === 'confirmada');
    const pending = filteredData.filter(r => r.status === 'pendiente');
    const cancelled = filteredData.filter(r => r.status === 'cancelada');
    const totalGuests = confirmed.reduce((sum, r) => sum + r.guests, 0);
    const avgPartySize = totalGuests > 0 ? (totalGuests / confirmed.length).toFixed(1) : '0';
    const cancellationRate = totalReservations > 0 ? ((cancelled.length / totalReservations) * 100).toFixed(1) + '%' : '0%';
    
    const statusDistribution = {
        labels: ['Confirmadas', 'Pendientes', 'Canceladas'],
        data: [confirmed.length, pending.length, cancelled.length]
    };

    const reservationsByTime: { [key: string]: { confirmed: number, pending: number, cancelled: number } } = {};
    
    filteredData.forEach(r => {
        const date = r.date instanceof Date ? r.date : r.date.toDate();
        let key = '';
        if (groupBy === 'day') key = date.toLocaleDateString('es-AR', { month: '2-digit', day: '2-digit' });
        else if (groupBy === 'week') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = `Sem. ${startOfWeek.toLocaleDateString('es-AR', { month: '2-digit', day: '2-digit' })}`;
        } else key = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        if (!reservationsByTime[key]) {
            reservationsByTime[key] = { confirmed: 0, pending: 0, cancelled: 0 };
        }

        if (r.status === 'confirmada') reservationsByTime[key].confirmed++;
        else if (r.status === 'pendiente') reservationsByTime[key].pending++;
        else if (r.status === 'cancelada') reservationsByTime[key].cancelled++;
    });
    
    const sortedKeys = Object.keys(reservationsByTime).sort((a,b) => a.localeCompare(b));
    const trendData = {
        labels: sortedKeys,
        datasets: {
            confirmed: sortedKeys.map(key => reservationsByTime[key].confirmed),
            pending: sortedKeys.map(key => reservationsByTime[key].pending),
            cancelled: sortedKeys.map(key => reservationsByTime[key].cancelled),
        }
    };

    // Customer Analytics
    const totalCustomers = allCustomers.length;
    const avgReservationsPerCustomer = totalCustomers > 0 ? (allReservations.length / totalCustomers).toFixed(1) : '0';
    
    const startDate = new Date(dateRange.start + 'T00:00:00');
    const newCustomersInRange = allCustomers.filter(c => {
        const firstSeenDate = c.firstSeen instanceof Date ? c.firstSeen : c.firstSeen.toDate();
        return firstSeenDate >= startDate;
    }).length;

    const customerIdsInPeriod = [...new Set(filteredData.map(r => r.customerId).filter(Boolean))];
    const repeatCustomersInRange = allCustomers.filter(c => 
        customerIdsInPeriod.includes(c.id) && (c.firstSeen instanceof Date ? c.firstSeen : c.firstSeen.toDate()) < startDate
    ).length;

    const topCustomers = allCustomers
      .map(c => ({...c, reservationCount: c.reservationIds.length}))
      .sort((a, b) => b.reservationCount - a.reservationCount)
      .slice(0, 5);

    return { totalReservations, totalGuests, avgPartySize, cancellationRate, statusDistribution, topCustomers, trendData, totalCustomers, newCustomersInRange, repeatCustomersInRange, avgReservationsPerCustomer };
  }, [filteredData, allCustomers, allReservations, groupBy, dateRange]);

  // Effect for Bar Chart
  useEffect(() => {
    if (barChartRef.current && analytics?.trendData) {
      if (barChartInstance.current) barChartInstance.current.destroy();
      const ctx = barChartRef.current.getContext('2d');
      if (ctx) {
        barChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: analytics.trendData.labels,
            datasets: [
                {
                    label: 'Confirmadas',
                    data: analytics.trendData.datasets.confirmed,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)', // #10B981
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Pendientes',
                    data: analytics.trendData.datasets.pending,
                    backgroundColor: 'rgba(245, 158, 11, 0.6)', // #F59E0B
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Canceladas',
                    data: analytics.trendData.datasets.cancelled,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)', // #EF4444
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, ticks: { color: '#a8a29e' }, grid: { color: '#3f3f46' }, stacked: true },
              x: { ticks: { color: '#a8a29e' }, grid: { color: 'transparent' }, stacked: true }
            },
            plugins: { legend: { position: 'bottom', labels: { color: '#a8a29e' } } }
          }
        });
      }
    }
  }, [analytics]);

  // Effect for Pie Chart
  useEffect(() => {
    if (pieChartRef.current && analytics?.statusDistribution) {
      if (pieChartInstance.current) pieChartInstance.current.destroy();
      const ctx = pieChartRef.current.getContext('2d');
      if (ctx) {
        pieChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: analytics.statusDistribution.labels,
            datasets: [{
              data: analytics.statusDistribution.data,
              backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
              borderColor: '#050505',
              borderWidth: 4
            }]
          },
           options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a8a29e', boxWidth: 12, padding: 20 } }
            }
          }
        });
      }
    }
  }, [analytics]);


  if (loading) return <div className="text-white text-center p-10">Cargando datos de analíticas...</div>;

  const inputClasses = "bg-stone-900 border border-stone-700 rounded-sm py-2 px-3 text-sm focus:border-gold outline-none";
  const labelClasses = "text-xs uppercase text-stone-500 font-bold";
  const buttonGroupBase = "px-3 py-1.5 text-xs rounded-sm transition-colors uppercase tracking-widest";
  const quickFilters = [
    { key: 'all', label: 'Todo' },
    { key: '7d', label: 'Últimos 7d' },
    { key: '14d', label: 'Últimos 14d' },
    { key: '30d', label: 'Últimos 30d' },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="bg-stone-900/50 border border-stone-800 rounded-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-1 bg-stone-800/50 p-1 rounded-sm">
                {quickFilters.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => handleQuickFilterClick(key)}
                        className={`${buttonGroupBase} ${activeFilter === key ? 'bg-gold text-black' : 'text-stone-400 hover:bg-stone-700'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="w-px h-6 bg-stone-700 hidden md:block"></div>
            <div className="flex items-center gap-2">
                <label className={labelClasses}>Desde:</label>
                <input type="date" className={inputClasses} value={dateRange.start} onChange={e => { setDateRange(prev => ({ ...prev, start: e.target.value })); setActiveFilter(null); }} />
                <label className={labelClasses}>Hasta:</label>
                <input type="date" className={inputClasses} value={dateRange.end} onChange={e => { setDateRange(prev => ({ ...prev, end: e.target.value })); setActiveFilter(null); }} />
            </div>
        </div>
      </div>
      
      {!analytics ? <p className="text-center text-stone-600 italic py-16">No hay datos de reservas para el período seleccionado.</p> :
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Reservas" value={analytics.totalReservations} description="En el período seleccionado." />
          <StatCard title="Total Comensales" value={analytics.totalGuests} description="Sumatoria de reservas confirmadas."/>
          <StatCard title="Grupo Promedio" value={analytics.avgPartySize} description="Personas por reserva confirmada." />
          <StatCard title="Tasa Cancelación" value={analytics.cancellationRate} description="Porcentaje de reservas canceladas." />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-stone-900/50 border border-stone-800 rounded-sm p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-serif text-white">Tendencia de Reservas</h3>
                <div className="flex gap-1 bg-stone-800/50 p-1 rounded-sm">
                    <button onClick={() => setGroupBy('day')} className={`${buttonGroupBase} ${groupBy === 'day' ? 'bg-gold text-black' : 'text-stone-400'}`}>Día</button>
                    <button onClick={() => setGroupBy('week')} className={`${buttonGroupBase} ${groupBy === 'week' ? 'bg-gold text-black' : 'text-stone-400'}`}>Semana</button>
                    <button onClick={() => setGroupBy('month')} className={`${buttonGroupBase} ${groupBy === 'month' ? 'bg-gold text-black' : 'text-stone-400'}`}>Mes</button>
                </div>
            </div>
            <div className="relative h-80"><canvas ref={barChartRef}></canvas></div>
          </div>
          <div className="bg-stone-900/50 border border-stone-800 rounded-sm p-6 shadow-lg">
            <h3 className="text-xl font-serif text-white mb-4">Distribución de Estados</h3>
            <div className="relative h-80"><canvas ref={pieChartRef}></canvas></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Clientes" value={analytics.totalCustomers} description="Clientes únicos en la base de datos." />
            <StatCard title="Nuevos Clientes" value={analytics.newCustomersInRange} description="Primera visita en este período."/>
            <StatCard title="Clientes Recurrentes" value={analytics.repeatCustomersInRange} description="Clientes que volvieron en este período." />
            <StatCard title="Reservas / Cliente" value={analytics.avgReservationsPerCustomer} description="Promedio histórico de reservas." />
        </div>

        <div className="bg-stone-900/50 border border-stone-800 rounded-sm p-6 shadow-lg">
          <h3 className="text-xl font-serif text-white mb-4">Clientes Destacados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-stone-700"><th className="pb-3 text-xs uppercase tracking-widest text-gold font-semibold">#</th><th className="pb-3 text-xs uppercase tracking-widest text-gold font-semibold">Nombre</th><th className="pb-3 text-xs uppercase tracking-widest text-gold font-semibold">Teléfono</th><th className="pb-3 text-xs uppercase tracking-widest text-gold font-semibold text-center">N° Reservas</th></tr></thead>
              <tbody>
                {analytics.topCustomers.map((c, i) => (
                    <tr key={c.id} className="border-b border-stone-800/50"><td className="py-3 font-mono text-stone-500">{i+1}</td><td className="py-3 text-white font-semibold">{c.name}</td><td className="py-3 text-stone-400 font-mono">{c.phone}</td><td className="py-3 text-center text-gold font-bold text-lg">{c.reservationCount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    }
    </div>
  );
};

export default AdminAnalytics;