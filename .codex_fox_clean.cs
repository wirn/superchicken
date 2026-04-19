using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

class Program
{
    static void Main()
    {
        var dir = @"C:\repos\superchicken\public\assets";
        for (int i = 0; i < 4; i++)
        {
            var input = Path.Combine(dir, $"fox-{i}.png");
            var output = Path.Combine(dir, $"fox-{i}-clean.png");
            using var src = new Bitmap(input);
            int w = src.Width, h = src.Height;
            var visited = new bool[w, h];
            List<Point> best = new();

            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    if (visited[x, y]) continue;
                    visited[x, y] = true;
                    if (src.GetPixel(x, y).A == 0) continue;

                    var q = new Queue<Point>();
                    var comp = new List<Point>();
                    q.Enqueue(new Point(x, y));
                    comp.Add(new Point(x, y));

                    while (q.Count > 0)
                    {
                        var p = q.Dequeue();
                        TryVisit(p.X - 1, p.Y);
                        TryVisit(p.X + 1, p.Y);
                        TryVisit(p.X, p.Y - 1);
                        TryVisit(p.X, p.Y + 1);

                        void TryVisit(int nx, int ny)
                        {
                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
                            if (visited[nx, ny]) return;
                            visited[nx, ny] = true;
                            if (src.GetPixel(nx, ny).A == 0) return;
                            var np = new Point(nx, ny);
                            q.Enqueue(np);
                            comp.Add(np);
                        }
                    }

                    if (comp.Count > best.Count)
                    {
                        best = comp;
                    }
                }
            }

            using var dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            foreach (var p in best)
            {
                dst.SetPixel(p.X, p.Y, src.GetPixel(p.X, p.Y));
            }
            dst.Save(output, ImageFormat.Png);
            Console.WriteLine(output);
        }
    }
}
