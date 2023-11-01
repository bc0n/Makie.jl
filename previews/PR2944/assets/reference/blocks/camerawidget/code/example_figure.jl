# This file was generated, do not modify it. # hide
using Makie.LaTeXStrings: @L_str # hide
__result = begin # hide
    using GLMakie
GLMakie.activate!() # hide

fig = Figure()
ax = LScene(fig[1, 1])
meshscatter!(ax, rand(Point3f, 10))

cw = CameraWidget(ax)

fig
end # hide
save(joinpath(@OUTPUT, "example_350888229989373663.png"), __result; ) # hide

nothing # hide