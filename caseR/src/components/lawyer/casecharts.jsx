import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_DATA } from "../data/mockdata";

const TooltipStyle = {
  border: "1px solid #E6DFD4",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(28,25,22,0.08)",
};

export default function CaseCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Monthly Bar */}
      <Card className="shadow-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-[14px] text-muted-foreground font-medium uppercase tracking-wide">Cases Filed — Last 6 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={CHART_DATA.monthlyFiled} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8C7B6C" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8C7B6C" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TooltipStyle} cursor={{ fill: "rgba(201,146,43,0.05)" }} />
              <Bar dataKey="cases" radius={[5, 5, 0, 0]}
                fill="url(#goldGrad)" />
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#E8B84B" />
                  <stop offset="100%" stopColor="#C9922B" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Status Donut */}
      <Card className="shadow-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-[14px] text-muted-foreground font-medium uppercase tracking-wide">Cases by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={CHART_DATA.casesByStatus} cx="50%" cy="50%"
                innerRadius={60} outerRadius={88} paddingAngle={3} dataKey="value">
                {CHART_DATA.casesByStatus.map((e) => (
                  <Cell key={e.name} fill={e.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={TooltipStyle} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "#6B5A4C" }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category horizontal bar */}
      <Card className="shadow-card lg:col-span-2">
        <CardHeader className="pb-1">
          <CardTitle className="text-[14px] text-muted-foreground font-medium uppercase tracking-wide">Distribution by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={CHART_DATA.casesByCategory} layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8C7B6C" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#5A4A3A" }}
                axisLine={false} tickLine={false} width={72} />
              <Tooltip contentStyle={TooltipStyle} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                {CHART_DATA.casesByCategory.map((e) => (
                  <Cell key={e.name} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}