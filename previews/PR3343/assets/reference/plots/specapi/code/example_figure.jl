# This file was generated, do not modify it. # hide
using Makie.LaTeXStrings: @L_str # hide
__result = begin # hide
    using CairoMakie
import Makie.SpecApi as S
struct LineScatter
    show_lines::Bool
    show_scatter::Bool
    kw::Dict{Symbol,Any}
end
LineScatter(lines, scatter; kw...) = LineScatter(lines, scatter, Dict{Symbol,Any}(kw))

function Makie.convert_arguments(::Type{<:AbstractPlot}, obj::LineScatter, data...)
    plots = PlotSpec[]
    if obj.show_lines
        push!(plots, S.lines(data...; obj.kw...))
    end
    if obj.show_scatter
        push!(plots, S.scatter(data...; obj.kw...))
    end
    return plots
end

f = Figure()
ax = Axis(f[1, 1])
# Can be plotted into Axis, since it doesn't create its own axes like FigureSpec
plot!(ax, LineScatter(true, true; markersize=20, color=1:4), 1:4)
plot!(ax, LineScatter(true, false; color=:darkcyan, linewidth=3), 2:4)
f
end # hide
save(joinpath(@OUTPUT, "example_17308281875104159140.png"), __result; ) # hide

nothing # hide