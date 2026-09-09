using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Portal.Migrations
{
    /// <inheritdoc />
    public partial class VersionedCharacterSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "StateVersion",
                table: "Characters",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StateVersion",
                table: "Characters");
        }
    }
}
